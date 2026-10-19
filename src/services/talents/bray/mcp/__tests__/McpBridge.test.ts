import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: jest.requireActual('./memoryAsyncStorage').default,
}));

import {TalentRegistry} from '../../../TalentRegistry';
import {McpBridge, MCP_TOOLS_CACHE_KEY} from '../McpBridge';
import {McpClient} from '../McpClient';
import {McpServerStore} from '../McpServerStore';
import {createFakeMcpServer, JOPLIN_TOOLS, offlineFetch} from './fakeMcpServer';

const URL = 'http://192.168.1.50:9095/mcp';

const setup = async (fetchImpl: any, tools?: string[]) => {
  const store = new McpServerStore();
  await store.load();
  await store.addServer({name: 'joplin', url: URL, tools});
  const registry = new TalentRegistry();
  let currentFetch = fetchImpl;
  const bridge = new McpBridge({
    registry,
    store,
    clientFactory: s =>
      new McpClient({
        url: s.url,
        headers: s.headers,
        fetchImpl: (u, i) => currentFetch(u, i),
      }),
    approve: async () => true,
  });
  return {
    store,
    registry,
    bridge,
    setFetch: (f: any) => {
      currentFetch = f;
    },
  };
};

const mcpNames = (registry: TalentRegistry) =>
  registry
    .getAll()
    .map(e => e.name)
    .sort();

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('McpBridge', () => {
  it('registers one talent per discovered tool', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const {registry, bridge} = await setup(server.fetch);
    await bridge.sync();
    expect(mcpNames(registry)).toEqual([
      'mcp_joplin_delete_note',
      'mcp_joplin_read_note',
      'mcp_joplin_search_notes',
    ]);
    expect(bridge.status.get('joplin')).toEqual({state: 'ok', toolCount: 3});
    const res = await registry
      .get('mcp_joplin_search_notes')!
      .execute({query: 'Tempus'});
    expect(res.summary).toBe('echo {"query":"Tempus"}');
  });

  it('honours the per-server tool allowlist', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const {registry, bridge} = await setup(server.fetch, [
      'search_notes',
      'read_note',
    ]);
    await bridge.sync();
    expect(mcpNames(registry)).toEqual([
      'mcp_joplin_read_note',
      'mcp_joplin_search_notes',
    ]);
  });

  it('an unreachable server never throws and is marked unreachable', async () => {
    const {registry, bridge} = await setup(offlineFetch);
    await expect(bridge.sync()).resolves.toBeUndefined();
    expect(mcpNames(registry)).toEqual([]);
    expect(bridge.status.get('joplin')?.state).toBe('unreachable');
  });

  it('when a known server goes offline its talents stay and say so', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const {store, bridge, setFetch} = await setup(server.fetch, [
      'search_notes',
    ]);
    await bridge.sync();
    expect(await AsyncStorage.getItem(MCP_TOOLS_CACHE_KEY)).toContain(
      'search_notes',
    );

    // Fresh app start while offline: talents come back from the cache.
    setFetch(offlineFetch);
    const registry2 = new TalentRegistry();
    const bridge2 = new McpBridge({
      registry: registry2,
      store,
      clientFactory: s => new McpClient({url: s.url, fetchImpl: offlineFetch}),
      approve: async () => true,
    });
    await bridge2.sync();
    expect(mcpNames(registry2)).toEqual(['mcp_joplin_search_notes']);
    const res = await registry2
      .get('mcp_joplin_search_notes')!
      .execute({query: 'x'});
    expect(res.summary).toBe("joplin isn't reachable right now (offline?)");
  });

  it('removing or disabling a server unregisters its talents', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const {store, registry, bridge} = await setup(server.fetch);
    await bridge.sync();
    await store.setEnabled('joplin', false);
    await bridge.sync();
    expect(mcpNames(registry)).toEqual([]);
    await store.setEnabled('joplin', true);
    await bridge.sync();
    expect(mcpNames(registry)).toHaveLength(3);
    await store.removeServer('joplin');
    await bridge.sync();
    expect(mcpNames(registry)).toEqual([]);
    expect(bridge.status.has('joplin')).toBe(false);
  });

  it('leaves non-MCP talents alone', async () => {
    const server = createFakeMcpServer({tools: JOPLIN_TOOLS});
    const {store, registry, bridge} = await setup(server.fetch);
    registry.register({
      name: 'calculate',
      execute: async () => ({type: 'text', summary: ''}),
      toToolDefinition: () => ({
        type: 'function',
        function: {name: 'calculate', description: '', parameters: {}},
      }),
    });
    await bridge.sync();
    await store.removeServer('joplin');
    await bridge.sync();
    expect(mcpNames(registry)).toEqual(['calculate']);
  });
});
