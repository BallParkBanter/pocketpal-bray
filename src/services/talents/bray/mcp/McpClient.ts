/**
 * Minimal MCP client over Streamable HTTP: initialize, tools/list, tools/call.
 *
 * Why not `@modelcontextprotocol/sdk`: its StreamableHTTPClientTransport reads
 * `response.body` as a WHATWG ReadableStream (piped through TextDecoderStream
 * and an EventSource parser). React Native's fetch is the XHR-backed
 * whatwg-fetch polyfill and has no streaming body, so every SSE reply would
 * fail under Hermes. MCP servers answer a POST with one JSON body or a short
 * SSE stream that closes after the response, so buffering `res.text()` and
 * parsing the `data:` lines is enough, with no polyfills and no new dependency.
 */

export type FetchLike = (url: string, init: any) => Promise<Response>;

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    [k: string]: unknown;
  };
}

export interface McpCallResult {
  content: Array<Record<string, any>>;
  structuredContent?: unknown;
  isError: boolean;
}

/** Network failure, timeout, or a gateway error: the server can't be reached. */
export class McpUnreachableError extends Error {}
/** The server answered with an HTTP error we don't treat as "offline". */
export class McpHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}
/** The server answered with a JSON-RPC error object. */
export class McpRpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

export interface McpClientOptions {
  url: string;
  headers?: Record<string, string>;
  fetchImpl?: FetchLike;
  /** initialize / tools/list timeout. */
  timeoutMs?: number;
  /** tools/call timeout. */
  callTimeoutMs?: number;
}

const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = {name: 'pocketpal-bray', version: '1'};
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CALL_TIMEOUT_MS = 30000;
const MAX_BODY_CHARS = 2 * 1024 * 1024;
const MAX_TOOL_PAGES = 10;
/** Proxy/gateway answers that mean "the thing behind me is down". */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

interface Session {
  id: string | null;
  version: string | null;
}

/** Await `p`, but reject with "cancelled" as soon as `signal` aborts. */
const waitUnlessAborted = <T>(
  p: Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  if (!signal) {
    return p;
  }
  if (signal.aborted) {
    return Promise.reject(new Error('cancelled'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('cancelled'));
    signal.addEventListener('abort', onAbort);
    p.then(resolve, reject).finally(() =>
      signal.removeEventListener('abort', onAbort),
    );
  });
};

/**
 * Pull the JSON-RPC response with `id` out of a reply body. SSE bodies may
 * carry server notifications/requests before the response; those are skipped.
 */
export function parseRpcResponse(
  body: string,
  contentType: string,
  id: number,
): Record<string, any> | undefined {
  const messages: any[] = [];
  if (contentType.includes('text/event-stream')) {
    const events = body.replace(/\r\n?/g, '\n').split('\n\n');
    for (const event of events) {
      const data = event
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (!data) {
        continue;
      }
      try {
        messages.push(JSON.parse(data));
      } catch {
        // Not JSON (keep-alive comment etc.) — ignore.
      }
    }
  } else if (body.trim()) {
    const parsed = JSON.parse(body);
    messages.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  return messages.find(
    m => m && m.id === id && ('result' in m || 'error' in m),
  );
}

export class McpClient {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly callTimeoutMs: number;
  private sessionId: string | null = null;
  private protocolVersion: string | null = null;
  private initializing: Promise<void> | null = null;
  private nextId = 1;

  constructor(opts: McpClientOptions) {
    this.url = opts.url;
    this.headers = opts.headers ?? {};
    this.fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.callTimeoutMs = opts.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
  }

  /** Drop the session so the next request re-initializes. */
  reset(): void {
    this.sessionId = null;
    this.protocolVersion = null;
    this.initializing = null;
  }

  async listTools(signal?: AbortSignal): Promise<McpToolInfo[]> {
    const tools: McpToolInfo[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOL_PAGES; page++) {
      const result = await this.request(
        'tools/list',
        cursor ? {cursor} : undefined,
        this.timeoutMs,
        signal,
      );
      tools.push(...((result?.tools as McpToolInfo[]) ?? []));
      cursor = result?.nextCursor;
      if (!cursor) {
        break;
      }
    }
    return tools.filter(t => t && typeof t.name === 'string');
  }

  async callTool(
    name: string,
    args: Record<string, any>,
    signal?: AbortSignal,
  ): Promise<McpCallResult> {
    const result = await this.request(
      'tools/call',
      {name, arguments: args ?? {}},
      this.callTimeoutMs,
      signal,
    );
    return {
      content: Array.isArray(result?.content) ? result.content : [],
      structuredContent: result?.structuredContent,
      isError: result?.isError === true,
    };
  }

  /**
   * One shared initialize per client. It runs on its own timeout, never on a
   * caller's signal, so one caller aborting can't fail the others; each caller
   * only stops *waiting* when its own signal fires.
   */
  private async ensureSession(signal?: AbortSignal): Promise<void> {
    if (this.protocolVersion) {
      return;
    }
    if (!this.initializing) {
      this.initializing = this.initialize().catch(e => {
        this.initializing = null;
        throw e;
      });
    }
    await waitUnlessAborted(this.initializing, signal);
  }

  private async initialize(): Promise<void> {
    const id = this.nextId++;
    const {msg, sessionId} = await this.post(
      {
        jsonrpc: '2.0',
        id,
        method: 'initialize',
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: CLIENT_INFO,
        },
      },
      this.timeoutMs,
      undefined,
      null,
    );
    const result = this.unwrap(msg);
    const session: Session = {
      id: sessionId,
      version:
        typeof result?.protocolVersion === 'string'
          ? result.protocolVersion
          : PROTOCOL_VERSION,
    };
    // Commit the session only once the handshake is complete, so a failed
    // notifications/initialized never leaves a half-open session behind.
    await this.post(
      {jsonrpc: '2.0', method: 'notifications/initialized'},
      this.timeoutMs,
      undefined,
      session,
    );
    this.sessionId = session.id;
    this.protocolVersion = session.version;
  }

  private async request(
    method: string,
    params: Record<string, any> | undefined,
    timeoutMs: number,
    signal?: AbortSignal,
    retried = false,
  ): Promise<any> {
    await this.ensureSession(signal);
    const id = this.nextId++;
    try {
      const {msg} = await this.post(
        {jsonrpc: '2.0', id, method, ...(params ? {params} : {})},
        timeoutMs,
        signal,
        {id: this.sessionId, version: this.protocolVersion},
      );
      return this.unwrap(msg);
    } catch (e) {
      // 404 with a session id = the server forgot us (restart). Re-init once.
      if (!retried && e instanceof McpHttpError && e.status === 404) {
        this.reset();
        return this.request(method, params, timeoutMs, signal, true);
      }
      if (e instanceof McpUnreachableError) {
        this.reset();
      }
      throw e;
    }
  }

  private unwrap(msg: Record<string, any> | undefined): any {
    if (!msg) {
      throw new McpRpcError('No response from server');
    }
    if (msg.error) {
      throw new McpRpcError(
        String(msg.error.message ?? 'Unknown error'),
        msg.error.code,
      );
    }
    return msg.result;
  }

  private async post(
    payload: Record<string, any>,
    timeoutMs: number,
    callerSignal: AbortSignal | undefined,
    session: Session | null,
  ): Promise<{msg?: Record<string, any>; sessionId: string | null}> {
    if (callerSignal?.aborted) {
      throw new Error('cancelled');
    }
    const headers: Record<string, string> = {
      ...this.headers,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (session?.id) {
      headers['Mcp-Session-Id'] = session.id;
    }
    if (session?.version) {
      headers['MCP-Protocol-Version'] = session.version;
    }

    const controller = new AbortController();
    let firedBy: 'caller' | 'timer' | undefined;
    const fire = (source: 'caller' | 'timer') => {
      firedBy ??= source;
      controller.abort();
    };
    const onCallerAbort = () => fire('caller');
    const timer = setTimeout(() => fire('timer'), timeoutMs);
    callerSignal?.addEventListener('abort', onCallerAbort);

    try {
      let res: Response;
      let body: string;
      try {
        res = await this.fetchImpl(this.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        body = res.ok ? await res.text() : '';
      } catch (e) {
        if (firedBy === 'caller') {
          throw new Error('cancelled');
        }
        throw new McpUnreachableError(
          firedBy === 'timer'
            ? 'timed out'
            : String((e as Error)?.message ?? e),
        );
      }
      if (!res.ok) {
        if (GATEWAY_STATUSES.has(res.status)) {
          throw new McpUnreachableError(`HTTP ${res.status}`);
        }
        throw new McpHttpError(res.status);
      }
      if (body.length > MAX_BODY_CHARS) {
        throw new McpRpcError('Response too large');
      }
      const sessionId = res.headers?.get?.('mcp-session-id') ?? null;
      if (payload.id === undefined) {
        return {sessionId};
      }
      const contentType = res.headers?.get?.('content-type') ?? '';
      let msg: Record<string, any> | undefined;
      try {
        msg = parseRpcResponse(body, contentType, payload.id);
      } catch {
        throw new McpRpcError('Unreadable response from server');
      }
      return {msg, sessionId};
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  }
}
