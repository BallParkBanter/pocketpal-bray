import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: jest.requireActual('./memoryAsyncStorage').default,
}));

import {
  MCP_SERVERS_KEY,
  McpServerStore,
  normalizeServerName,
} from '../McpServerStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('McpServerStore', () => {
  it('persists to bray.mcp.servers.v1 and seeds nothing', async () => {
    expect(MCP_SERVERS_KEY).toBe('bray.mcp.servers.v1');
    const store = new McpServerStore();
    await store.load();
    expect(store.servers).toEqual([]);

    expect(
      await store.addServer({
        name: 'Joplin',
        url: 'http://192.168.1.50:9095/mcp',
        tools: ['search_notes', 'read_note'],
      }),
    ).toBeNull();
    const raw = JSON.parse(
      (await AsyncStorage.getItem(MCP_SERVERS_KEY)) ?? '[]',
    );
    expect(raw).toEqual([
      {
        name: 'joplin',
        url: 'http://192.168.1.50:9095/mcp',
        enabled: true,
        tools: ['search_notes', 'read_note'],
      },
    ]);

    const again = new McpServerStore();
    await again.load();
    expect(again.servers[0].name).toBe('joplin');
  });

  it('rejects bad input with a plain message', async () => {
    const store = new McpServerStore();
    await store.load();
    expect(await store.addServer({name: '', url: 'http://x/mcp'})).toBe(
      'Name is required',
    );
    expect(await store.addServer({name: 'a', url: 'ftp://x'})).toBe(
      'URL must start with http:// or https://',
    );
    await store.addServer({name: 'a', url: 'http://x/mcp'});
    expect(await store.addServer({name: 'A', url: 'http://y/mcp'})).toBe(
      'A server named "a" already exists',
    );
  });

  it('removes and toggles servers', async () => {
    const store = new McpServerStore();
    await store.load();
    await store.addServer({name: 'a', url: 'http://x/mcp'});
    await store.setEnabled('a', false);
    expect(store.servers[0].enabled).toBe(false);
    await store.removeServer('a');
    expect(store.servers).toEqual([]);
    expect(await AsyncStorage.getItem(MCP_SERVERS_KEY)).toBe('[]');
  });

  it('survives corrupt storage', async () => {
    await AsyncStorage.setItem(MCP_SERVERS_KEY, '{not json');
    const store = new McpServerStore();
    await store.load();
    expect(store.servers).toEqual([]);
  });
});

describe('normalizeServerName', () => {
  it('keeps [a-z0-9_] and caps length', () => {
    expect(normalizeServerName(' Home Assistant! ')).toBe('home_assistant');
    expect(normalizeServerName('x'.repeat(50)).length).toBe(20);
  });
});
