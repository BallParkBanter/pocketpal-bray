import AsyncStorage from '@react-native-async-storage/async-storage';
import {makeAutoObservable, runInAction} from 'mobx';

export const MCP_SERVERS_KEY = 'bray.mcp.servers.v1';
const MAX_SERVER_NAME = 20;

export interface McpServerConfig {
  /** `[a-z0-9_]`; becomes the middle of `mcp_<name>_<tool>`. */
  name: string;
  url: string;
  headers?: Record<string, string>;
  enabled: boolean;
  /** Optional allowlist of tool names; absent = every tool the server lists. */
  tools?: string[];
}

export interface NewMcpServer {
  name: string;
  url: string;
  headers?: Record<string, string>;
  tools?: string[];
}

export const normalizeServerName = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, MAX_SERVER_NAME)
    .replace(/_+$/, '');

const isHttpUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
};

const sanitize = (raw: any): McpServerConfig | null => {
  if (!raw || typeof raw.name !== 'string' || typeof raw.url !== 'string') {
    return null;
  }
  const out: McpServerConfig = {
    name: normalizeServerName(raw.name),
    url: raw.url,
    enabled: raw.enabled !== false,
  };
  if (raw.headers && typeof raw.headers === 'object') {
    out.headers = raw.headers;
  }
  if (Array.isArray(raw.tools)) {
    out.tools = raw.tools.filter((t: unknown) => typeof t === 'string');
  }
  return out.name ? out : null;
};

/** MCP servers Bo added in Settings → MCP Servers. Seeds nothing. */
export class McpServerStore {
  servers: McpServerConfig[] = [];
  loaded = false;
  private loading: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = this.readFromStorage();
    }
    return this.loading;
  }

  private async readFromStorage(): Promise<void> {
    let servers: McpServerConfig[] = [];
    try {
      const raw = await AsyncStorage.getItem(MCP_SERVERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        servers = parsed
          .map(sanitize)
          .filter((s): s is McpServerConfig => s !== null);
      }
    } catch {
      servers = [];
    }
    runInAction(() => {
      this.servers = servers;
      this.loaded = true;
    });
  }

  /** Returns null on success, or a plain-English reason it was rejected. */
  async addServer(input: NewMcpServer): Promise<string | null> {
    await this.load();
    const name = normalizeServerName(input.name ?? '');
    const url = (input.url ?? '').trim();
    if (!name) {
      return 'Name is required';
    }
    if (!isHttpUrl(url)) {
      return 'URL must start with http:// or https://';
    }
    if (this.servers.some(s => s.name === name)) {
      return `A server named "${name}" already exists`;
    }
    const server: McpServerConfig = {name, url, enabled: true};
    if (input.headers && Object.keys(input.headers).length > 0) {
      server.headers = input.headers;
    }
    const tools = (input.tools ?? []).map(t => t.trim()).filter(Boolean);
    if (tools.length > 0) {
      server.tools = tools;
    }
    runInAction(() => {
      this.servers = [...this.servers, server];
    });
    await this.persist();
    return null;
  }

  async removeServer(name: string): Promise<void> {
    await this.load();
    runInAction(() => {
      this.servers = this.servers.filter(s => s.name !== name);
    });
    await this.persist();
  }

  async setEnabled(name: string, enabled: boolean): Promise<void> {
    await this.load();
    runInAction(() => {
      this.servers = this.servers.map(s =>
        s.name === name ? {...s, enabled} : s,
      );
    });
    await this.persist();
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(this.servers));
  }
}

export const mcpServerStore = new McpServerStore();
