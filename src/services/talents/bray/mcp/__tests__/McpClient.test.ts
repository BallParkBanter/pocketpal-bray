import {
  McpClient,
  McpRpcError,
  McpUnreachableError,
  parseRpcResponse,
} from '../McpClient';
import {createFakeMcpServer, JOPLIN_TOOLS, offlineFetch} from './fakeMcpServer';

const URL = 'http://192.168.1.50:9095/mcp';

describe('McpClient against the fake server', () => {
  it.each(['sse', 'json'] as const)(
    'initializes and lists tools (%s replies)',
    async mode => {
      const server = createFakeMcpServer({tools: JOPLIN_TOOLS, mode});
      const client = new McpClient({url: URL, fetchImpl: server.fetch});
      const tools = await client.listTools();
      expect(tools.map(t => t.name)).toEqual([
        'search_notes',
        'read_note',
        'delete_note',
      ]);
      expect(server.requests.map(r => r.method)).toEqual([
        'initialize',
        'notifications/initialized',
        'tools/list',
      ]);
      const listReq = server.requests[2];
      expect(listReq.headers['mcp-session-id']).toBe('s1');
      expect(listReq.headers['mcp-protocol-version']).toBeTruthy();
    },
  );

  it('follows nextCursor pagination', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS, pageSize: 1});
    const client = new McpClient({url: URL, fetchImpl: server.fetch});
    const tools = await client.listTools();
    expect(tools).toHaveLength(3);
  });

  it('round-trips tools/call', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const client = new McpClient({url: URL, fetchImpl: server.fetch});
    const res = await client.callTool('search_notes', {query: 'Tempus'});
    expect(res.isError).toBe(false);
    expect(res.content[0].text).toBe('echo {"query":"Tempus"}');
  });

  it('sends custom headers on every request', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const client = new McpClient({
      url: URL,
      headers: {Authorization: 'Bearer x'},
      fetchImpl: server.fetch,
    });
    await client.listTools();
    expect(
      server.requests.every(r => r.headers.authorization === 'Bearer x'),
    ).toBe(true);
  });

  it('re-initializes once when the server forgets the session', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const client = new McpClient({url: URL, fetchImpl: server.fetch});
    await client.listTools();
    server.dropSessions();
    const res = await client.callTool('read_note', {note_id: 'abc'});
    expect(res.isError).toBe(false);
    expect(server.requests.filter(r => r.method === 'initialize')).toHaveLength(
      2,
    );
  });

  it('turns a JSON-RPC error into McpRpcError', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const client = new McpClient({url: URL, fetchImpl: server.fetch});
    await expect(client.callTool('nope', {})).rejects.toBeInstanceOf(
      McpRpcError,
    );
  });

  it('turns a network failure into McpUnreachableError', async () => {
    const client = new McpClient({url: URL, fetchImpl: offlineFetch});
    await expect(client.listTools()).rejects.toBeInstanceOf(
      McpUnreachableError,
    );
  });

  it('turns a hung server into McpUnreachableError after the timeout', async () => {
    const hang = (_u: string, init: any) =>
      new Promise<Response>((_res, rej) => {
        init.signal.addEventListener('abort', () => rej(new Error('aborted')));
      });
    const client = new McpClient({url: URL, fetchImpl: hang, timeoutMs: 20});
    await expect(client.listTools()).rejects.toBeInstanceOf(
      McpUnreachableError,
    );
  });

  it('treats a 502 from a proxy as unreachable', async () => {
    const bad = async () =>
      ({
        ok: false,
        status: 502,
        headers: {get: () => null},
        text: async () => 'Bad Gateway',
      }) as unknown as Response;
    const client = new McpClient({url: URL, fetchImpl: bad});
    await expect(client.listTools()).rejects.toBeInstanceOf(
      McpUnreachableError,
    );
  });

  it('a caller abort is reported as cancelled, not unreachable', async () => {
    const hang = (_u: string, init: any) =>
      new Promise<Response>((_res, rej) => {
        init.signal.addEventListener('abort', () => rej(new Error('aborted')));
      });
    const client = new McpClient({url: URL, fetchImpl: hang});
    const ac = new AbortController();
    const p = client.listTools(ac.signal);
    ac.abort();
    await expect(p).rejects.toThrow('cancelled');
  });
});

describe('parseRpcResponse', () => {
  it('picks the response with the matching id out of an SSE stream', () => {
    const body =
      'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"a":1}}\n\n' +
      'data: {"jsonrpc":"2.0","id":8,\ndata: "result":{"b":2}}\n\n';
    expect(parseRpcResponse(body, 'text/event-stream', 8)).toEqual({
      jsonrpc: '2.0',
      id: 8,
      result: {b: 2},
    });
  });

  it('handles CRLF line endings', () => {
    const body =
      'event: message\r\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\r\n\r\n';
    expect(parseRpcResponse(body, 'text/event-stream', 1)?.id).toBe(1);
  });

  it('handles a JSON batch array', () => {
    const body = '[{"jsonrpc":"2.0","id":2,"result":{"x":1}}]';
    expect(parseRpcResponse(body, 'application/json', 2)?.result).toEqual({
      x: 1,
    });
  });
});
