/**
 * In-process fake of a Streamable-HTTP MCP server. Exposes a `fetch`-shaped
 * function so McpClient can be exercised end to end without a socket.
 * Mirrors what Bo's Joplin MCP (FastMCP) actually does: SSE replies by
 * default, an `mcp-session-id` header on initialize, 202 for notifications,
 * 404 for an unknown session.
 */
import type {McpToolInfo} from '../McpClient';

export interface FakeServerOptions {
  tools: McpToolInfo[];
  /** Reply format. FastMCP uses SSE. */
  mode?: 'sse' | 'json';
  /** Tool implementations; default echoes the arguments. */
  handlers?: Record<
    string,
    (args: Record<string, any>) => {
      content: Array<Record<string, any>>;
      isError?: boolean;
    }
  >;
  /** Split tools/list into pages of this size (exercises nextCursor). */
  pageSize?: number;
}

export interface FakeServer {
  fetch: (url: string, init: any) => Promise<Response>;
  requests: Array<{method: string; headers: Record<string, string>}>;
  /** Forget every session, as a server restart would. */
  dropSessions: () => void;
}

const lowerHeaders = (h: any): Record<string, string> => {
  const out: Record<string, string> = {};
  Object.entries(h ?? {}).forEach(([k, v]) => {
    out[k.toLowerCase()] = String(v);
  });
  return out;
};

const reply = (
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response => {
  const h = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {get: (name: string) => h.get(name.toLowerCase()) ?? null},
    text: async () => body,
  } as unknown as Response;
};

export function createFakeMcpServer(opts: FakeServerOptions): FakeServer {
  const mode = opts.mode ?? 'sse';
  let sessions = new Set<string>();
  let nextSession = 1;
  const requests: FakeServer['requests'] = [];

  const respond = (
    msg: Record<string, any>,
    extra: Record<string, string> = {},
  ) =>
    mode === 'sse'
      ? reply(
          200,
          // A server->client notification first, to prove the client skips it.
          'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/message","params":{}}\n\n' +
            `event: message\ndata: ${JSON.stringify(msg)}\n\n`,
          {'content-type': 'text/event-stream', ...extra},
        )
      : reply(200, JSON.stringify(msg), {
          'content-type': 'application/json',
          ...extra,
        });

  const fetchImpl = async (_url: string, init: any): Promise<Response> => {
    const headers = lowerHeaders(init?.headers);
    const body = JSON.parse(init.body);
    requests.push({method: body.method, headers});
    if (!String(headers.accept ?? '').includes('text/event-stream')) {
      return reply(406, 'Not Acceptable');
    }
    if (body.method === 'initialize') {
      const sid = `s${nextSession++}`;
      sessions.add(sid);
      return respond(
        {
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: body.params.protocolVersion,
            capabilities: {tools: {}},
            serverInfo: {name: 'fake', version: '1'},
          },
        },
        {'mcp-session-id': sid},
      );
    }
    const sid = headers['mcp-session-id'];
    if (!sid || !sessions.has(sid)) {
      return reply(404, 'session not found');
    }
    if (body.id === undefined) {
      return reply(202, '');
    }
    if (body.method === 'tools/list') {
      const size = opts.pageSize ?? opts.tools.length;
      const start = body.params?.cursor ? Number(body.params.cursor) : 0;
      const page = opts.tools.slice(start, start + size);
      const next =
        start + size < opts.tools.length ? String(start + size) : undefined;
      return respond({
        jsonrpc: '2.0',
        id: body.id,
        result: {tools: page, ...(next ? {nextCursor: next} : {})},
      });
    }
    if (body.method === 'tools/call') {
      const {name, arguments: args} = body.params;
      if (!opts.tools.some(t => t.name === name)) {
        return respond({
          jsonrpc: '2.0',
          id: body.id,
          error: {code: -32602, message: `Unknown tool: ${name}`},
        });
      }
      const handler =
        opts.handlers?.[name] ??
        ((a: Record<string, any>) => ({
          content: [{type: 'text', text: `echo ${JSON.stringify(a)}`}],
        }));
      return respond({
        jsonrpc: '2.0',
        id: body.id,
        result: handler(args ?? {}),
      });
    }
    return respond({
      jsonrpc: '2.0',
      id: body.id,
      error: {code: -32601, message: 'Method not found'},
    });
  };

  return {
    fetch: fetchImpl,
    requests,
    dropSessions: () => {
      sessions = new Set();
    },
  };
}

/** A fetch that behaves like a phone in airplane mode. */
export const offlineFetch = async (): Promise<Response> => {
  throw new TypeError('Network request failed');
};

export const JOPLIN_TOOLS: McpToolInfo[] = [
  {
    name: 'search_notes',
    description:
      'Search the ENTIRE knowledge base (all notebooks) by title and body.\n\nWord-based AND search: every word must appear somewhere in the note.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {type: 'string', description: 'Search words'},
        limit: {type: 'integer', default: 50, description: 'Max results'},
      },
      required: ['query'],
    },
  },
  {
    name: 'read_note',
    description: "Read a note's full content by ID.",
    inputSchema: {
      type: 'object',
      properties: {note_id: {type: 'string', description: 'The note ID'}},
      required: ['note_id'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note.',
    inputSchema: {
      type: 'object',
      properties: {note_id: {type: 'string'}},
      required: ['note_id'],
    },
  },
];
