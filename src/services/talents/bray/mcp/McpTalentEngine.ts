import type {
  TalentEngine,
  TalentExecuteContext,
  TalentResult,
  ToolDefinition,
} from '../../types';
import {
  McpCallResult,
  McpClient,
  McpRpcError,
  McpToolInfo,
  McpUnreachableError,
} from './McpClient';

/** Tool results fed to the model are capped so they fit n_ctx=2048. */
export const MAX_TOOL_CHARS = 1200;
const TRUNCATION_MARKER = '…(truncated)';
const MAX_TALENT_NAME = 64;
const MAX_DESCRIPTION = 240;
const MAX_PARAM_DESCRIPTION = 120;

/** Tool names that read without changing anything never ask for approval. */
const READ_ONLY_VERB =
  /^(search|read|get|list|find|ping|fetch|query|lookup|show|describe|count|browse|view)(_|$)/;

export const unreachableMessage = (server: string): string =>
  `${server} isn't reachable right now (offline?)`;

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

/** `mcp_<server>_<tool>`, `[a-z0-9_]`, at most 64 chars. */
export function talentNameFor(server: string, tool: string): string {
  return `mcp_${slug(server)}_${slug(tool)}`
    .slice(0, MAX_TALENT_NAME)
    .replace(/_+$/, '');
}

export const truncate = (text: string, max = MAX_TOOL_CHARS): string =>
  text.length <= max
    ? text
    : text.slice(0, max - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;

/** First paragraph only — a 2B model with n_ctx 2048 can't afford essays. */
const shortDescription = (desc?: string): string => {
  const first = (desc ?? '')
    .trim()
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ');
  return first.length > MAX_DESCRIPTION
    ? first.slice(0, MAX_DESCRIPTION - 1).trimEnd() + '…'
    : first;
};

/** Keep only what the model needs from a JSON-schema property. */
const slimProperty = (prop: any): Record<string, any> => {
  if (!prop || typeof prop !== 'object') {
    return {};
  }
  const out: Record<string, any> = {};
  if (prop.type) {
    out.type = prop.type;
  }
  if (typeof prop.description === 'string') {
    out.description = prop.description.slice(0, MAX_PARAM_DESCRIPTION);
  }
  if (Array.isArray(prop.enum)) {
    out.enum = prop.enum;
  }
  if (prop.items) {
    out.items = slimProperty(prop.items);
  }
  if (!out.type && Array.isArray(prop.anyOf)) {
    const firstTyped = prop.anyOf.find(
      (p: any) => p?.type && p.type !== 'null',
    );
    if (firstTyped) {
      out.type = firstTyped.type;
    }
  }
  return out;
};

const slimSchema = (schema?: Record<string, any>): Record<string, any> => {
  const props = schema?.properties ?? {};
  const out: Record<string, any> = {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, slimProperty(v)]),
    ),
  };
  if (Array.isArray(schema?.required) && schema!.required.length > 0) {
    out.required = schema!.required;
  }
  return out;
};

/** Compact pretty-printed JSON so more of the answer fits the budget. */
const compactText = (text: string): string => {
  const trimmed = text.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      // Not JSON after all.
    }
  }
  return trimmed;
};

export function formatToolResult(
  result: Pick<McpCallResult, 'content' | 'structuredContent'>,
): string {
  const parts = (result.content ?? []).map(item => {
    switch (item?.type) {
      case 'text':
        return compactText(String(item.text ?? ''));
      case 'resource':
        return typeof item.resource?.text === 'string'
          ? compactText(item.resource.text)
          : `[resource ${item.resource?.uri ?? ''}]`.trim();
      case 'resource_link':
        return `[link ${item.uri ?? ''}]`;
      default:
        return `[${item?.type ?? 'unknown'}]`;
    }
  });
  const text = parts.filter(Boolean).join('\n');
  if (text) {
    return text;
  }
  if (result.structuredContent !== undefined) {
    return JSON.stringify(result.structuredContent);
  }
  return '(no output)';
}

export function needsApproval(tool: McpToolInfo): boolean {
  if (tool.annotations?.readOnlyHint === true) {
    return false;
  }
  if (tool.annotations?.destructiveHint === true) {
    return true;
  }
  return !READ_ONLY_VERB.test(tool.name.toLowerCase());
}

export interface McpTalentEngineOptions {
  serverName: string;
  tool: McpToolInfo;
  getClient: () => McpClient;
  approve: (title: string, detail: string) => Promise<boolean>;
}

const errorResult = (summary: string): TalentResult => ({
  type: 'error',
  summary,
  errorMessage: summary,
});

/** One MCP tool exposed as a talent named `mcp_<server>_<tool>`. */
export class McpTalentEngine implements TalentEngine {
  readonly name: string;
  readonly serverName: string;
  readonly tool: McpToolInfo;
  private readonly getClient: () => McpClient;
  private readonly approve: McpTalentEngineOptions['approve'];

  constructor(opts: McpTalentEngineOptions) {
    this.serverName = opts.serverName;
    this.tool = opts.tool;
    this.getClient = opts.getClient;
    this.approve = opts.approve;
    this.name = talentNameFor(opts.serverName, opts.tool.name);
  }

  toToolDefinition(): ToolDefinition {
    const desc = shortDescription(this.tool.description);
    return {
      type: 'function',
      function: {
        name: this.name,
        description: `[${this.serverName}] ${desc || this.tool.name}`,
        parameters: slimSchema(this.tool.inputSchema),
      },
    };
  }

  async execute(
    args: Record<string, any>,
    ctx?: TalentExecuteContext,
  ): Promise<TalentResult> {
    const safeArgs = args && typeof args === 'object' ? args : {};
    if (needsApproval(this.tool)) {
      const allowed = await this.approve(
        `Allow ${this.serverName}: ${this.tool.name}?`,
        truncate(JSON.stringify(safeArgs, null, 1), 400),
      );
      if (!allowed) {
        return errorResult(
          `Bo declined: ${this.tool.name} on ${this.serverName}`,
        );
      }
    }
    try {
      const res = await this.getClient().callTool(
        this.tool.name,
        safeArgs,
        ctx?.signal,
      );
      const text = formatToolResult(res);
      if (res.isError) {
        return errorResult(truncate(`${this.serverName} error: ${text}`));
      }
      return {type: 'text', summary: truncate(text)};
    } catch (e) {
      if (e instanceof McpUnreachableError) {
        return errorResult(unreachableMessage(this.serverName));
      }
      const message =
        e instanceof McpRpcError
          ? e.message
          : String((e as Error)?.message ?? e);
      if (message === 'cancelled') {
        return errorResult(`${this.name}: cancelled`);
      }
      return errorResult(truncate(`${this.serverName} error: ${message}`));
    }
  }
}
