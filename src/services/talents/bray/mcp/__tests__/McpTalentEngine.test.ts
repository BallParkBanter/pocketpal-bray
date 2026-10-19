import {McpClient} from '../McpClient';
import {
  MAX_TOOL_CHARS,
  McpTalentEngine,
  formatToolResult,
  talentNameFor,
  unreachableMessage,
} from '../McpTalentEngine';
import {createFakeMcpServer, JOPLIN_TOOLS, offlineFetch} from './fakeMcpServer';

const URL = 'http://192.168.1.50:9095/mcp';

const engineFor = (
  toolName: string,
  fetchImpl: any,
  approve: (t: string, d: string) => Promise<boolean> = async () => true,
) => {
  const client = new McpClient({url: URL, fetchImpl});
  const tool = JOPLIN_TOOLS.find(t => t.name === toolName)!;
  return new McpTalentEngine({
    serverName: 'joplin',
    tool,
    getClient: () => client,
    approve,
  });
};

describe('talentNameFor', () => {
  it('builds mcp_<server>_<tool>', () => {
    expect(talentNameFor('joplin', 'search_notes')).toBe(
      'mcp_joplin_search_notes',
    );
  });

  it('lowercases and replaces anything outside [a-z0-9_]', () => {
    expect(talentNameFor('Home Assistant', 'Get-State.v2')).toBe(
      'mcp_home_assistant_get_state_v2',
    );
  });

  it('never exceeds 64 chars and stays [a-z0-9_]', () => {
    const name = talentNameFor('a'.repeat(40), 'b'.repeat(60));
    expect(name.length).toBeLessThanOrEqual(64);
    expect(name).toMatch(/^[a-z0-9_]+$/);
    expect(name.endsWith('_')).toBe(false);
  });
});

describe('McpTalentEngine', () => {
  it('advertises a compact tool definition', () => {
    const engine = engineFor('search_notes', offlineFetch);
    const def = engine.toToolDefinition();
    expect(def.function.name).toBe('mcp_joplin_search_notes');
    // Only the first paragraph of a long MCP description goes to the model.
    expect(def.function.description).toBe(
      '[joplin] Search the ENTIRE knowledge base (all notebooks) by title and body.',
    );
    expect(def.function.parameters).toEqual({
      type: 'object',
      properties: {
        query: {type: 'string', description: 'Search words'},
        limit: {type: 'integer', description: 'Max results'},
      },
      required: ['query'],
    });
  });

  it('round-trips a call through the fake server', async () => {
    const server = createFakeMcpServer({
      tools: JOPLIN_TOOLS,
      handlers: {
        search_notes: () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total_matched: 1,
                  results: [{title: '\u{1F3B5} Tablet Music Offline'}],
                },
                null,
                2,
              ),
            },
          ],
        }),
      },
    });
    const engine = engineFor('search_notes', server.fetch);
    const res = await engine.execute({query: 'Tempus'});
    expect(res.type).toBe('text');
    // Pretty-printed JSON is compacted so more of it fits the 1,200-char budget.
    expect(res.summary).toBe(
      '{"total_matched":1,"results":[{"title":"\u{1F3B5} Tablet Music Offline"}]}',
    );
  });

  it('returns the exact unreachable message when offline', async () => {
    const engine = engineFor('search_notes', offlineFetch);
    const res = await engine.execute({query: 'Tempus'});
    expect(res.type).toBe('error');
    expect(res.summary).toBe("joplin isn't reachable right now (offline?)");
    expect(unreachableMessage('joplin')).toBe(
      "joplin isn't reachable right now (offline?)",
    );
  });

  it('truncates long results to MAX_TOOL_CHARS with a marker', async () => {
    const server = createFakeMcpServer({
      tools: JOPLIN_TOOLS,
      handlers: {
        read_note: () => ({content: [{type: 'text', text: 'x'.repeat(5000)}]}),
      },
    });
    const res = await engineFor('read_note', server.fetch).execute({
      note_id: 'a',
    });
    expect(MAX_TOOL_CHARS).toBe(1200);
    expect(res.summary.length).toBe(MAX_TOOL_CHARS);
    expect(res.summary.endsWith('…(truncated)')).toBe(true);
  });

  it('surfaces a tool-reported error', async () => {
    const server = createFakeMcpServer({
      tools: JOPLIN_TOOLS,
      handlers: {
        read_note: () => ({
          content: [{type: 'text', text: 'Note not found'}],
          isError: true,
        }),
      },
    });
    const res = await engineFor('read_note', server.fetch).execute({
      note_id: 'zz',
    });
    expect(res.type).toBe('error');
    expect(res.summary).toBe('joplin error: Note not found');
  });

  it('read-only tools never ask', async () => {
    const approve = jest.fn(async () => true);
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    await engineFor('search_notes', server.fetch, approve).execute({
      query: 'q',
    });
    expect(approve).not.toHaveBeenCalled();
  });

  it('a tool that changes things asks first; Deny returns Bo declined', async () => {
    const approve = jest.fn(async () => false);
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const res = await engineFor('delete_note', server.fetch, approve).execute({
      note_id: 'abc',
    });
    expect(approve).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      type: 'error',
      summary: 'Bo declined: delete_note on joplin',
      errorMessage: 'Bo declined: delete_note on joplin',
    });
    expect(server.requests.some(r => r.method === 'tools/call')).toBe(false);
  });

  it('a tool that changes things runs after Allow', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const res = await engineFor(
      'delete_note',
      server.fetch,
      async () => true,
    ).execute({
      note_id: 'abc',
    });
    expect(res.type).toBe('text');
  });

  it('readOnlyHint overrides the name heuristic', async () => {
    const approve = jest.fn(async () => true);
    const client = new McpClient({url: URL, fetchImpl: offlineFetch});
    const engine = new McpTalentEngine({
      serverName: 'ha',
      tool: {name: 'turn_on', annotations: {readOnlyHint: true}},
      getClient: () => client,
      approve,
    });
    await engine.execute({});
    expect(approve).not.toHaveBeenCalled();
  });
});

describe('formatToolResult', () => {
  it('describes non-text content and falls back to structuredContent', () => {
    expect(
      formatToolResult({content: [{type: 'image', data: '', mimeType: 'x'}]}),
    ).toBe('[image]');
    expect(formatToolResult({content: [], structuredContent: {a: 1}})).toBe(
      '{"a":1}',
    );
    expect(formatToolResult({content: []})).toBe('(no output)');
  });
});
