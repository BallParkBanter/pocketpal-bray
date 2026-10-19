import AsyncStorage from '@react-native-async-storage/async-storage';
import {makeAutoObservable, observable, reaction, runInAction} from 'mobx';

import {talentRegistry, TalentRegistry} from '../../TalentRegistry';
import {McpClient, McpToolInfo, McpUnreachableError} from './McpClient';
import {McpTalentEngine} from './McpTalentEngine';
import {
  McpServerConfig,
  McpServerStore,
  mcpServerStore,
} from './McpServerStore';
import {askMcpApproval} from './mcpApproval';

/** Last good tools/list per server, so talents exist at start-up while offline. */
export const MCP_TOOLS_CACHE_KEY = 'bray.mcp.tools-cache.v1';

type ToolsCache = Record<string, {url: string; tools: McpToolInfo[]}>;

export type McpServerStatus =
  | {state: 'connecting'}
  | {state: 'ok'; toolCount: number}
  | {state: 'unreachable'; toolCount: number}
  | {state: 'error'; toolCount: number; message: string};

export interface McpBridgeDeps {
  registry: TalentRegistry;
  store: McpServerStore;
  clientFactory?: (server: McpServerConfig) => McpClient;
  approve?: (title: string, detail: string) => Promise<boolean>;
}

const serverKey = (s: McpServerConfig) =>
  JSON.stringify([s.url, s.headers ?? {}]);

/**
 * Keeps the talent registry in step with the MCP servers in McpServerStore:
 * one McpTalentEngine per (allowlisted) tool. Never throws and never blocks
 * the app on a slow or offline server.
 */
export class McpBridge {
  /** Per-server connection status, for the settings screen. */
  readonly status = observable.map<string, McpServerStatus>();
  syncing = false;

  private readonly registry: TalentRegistry;
  private readonly store: McpServerStore;
  private readonly clientFactory: (server: McpServerConfig) => McpClient;
  private readonly approve: (title: string, detail: string) => Promise<boolean>;
  private clients = new Map<string, {key: string; client: McpClient}>();
  /** talent names registered by this bridge, per server */
  private registered = new Map<string, string[]>();
  private queue: Promise<void> = Promise.resolve();

  constructor(deps: McpBridgeDeps) {
    this.registry = deps.registry;
    this.store = deps.store;
    this.clientFactory =
      deps.clientFactory ??
      (s => new McpClient({url: s.url, headers: s.headers}));
    this.approve = deps.approve ?? askMcpApproval;
    makeAutoObservable<
      McpBridge,
      'registry' | 'store' | 'clients' | 'registered' | 'queue'
    >(this, {
      registry: false,
      store: false,
      clients: false,
      registered: false,
      queue: false,
    });
  }

  /** Serialized: overlapping calls run one after another. */
  sync(): Promise<void> {
    const run = this.queue.then(() => this.doSync());
    this.queue = run.catch(() => undefined);
    return run;
  }

  private clientFor(server: McpServerConfig): McpClient {
    const key = serverKey(server);
    const existing = this.clients.get(server.name);
    if (existing && existing.key === key) {
      return existing.client;
    }
    const client = this.clientFactory(server);
    this.clients.set(server.name, {key, client});
    return client;
  }

  private async readCache(): Promise<ToolsCache> {
    try {
      const raw = await AsyncStorage.getItem(MCP_TOOLS_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async doSync(): Promise<void> {
    runInAction(() => {
      this.syncing = true;
    });
    try {
      await this.store.load();
      const servers = this.store.servers.filter(s => s.enabled);
      const wanted = new Set(servers.map(s => s.name));

      // Drop talents of servers that were removed or disabled.
      for (const name of Array.from(this.registered.keys())) {
        if (!wanted.has(name)) {
          this.unregisterServer(name);
          this.clients.delete(name);
        }
      }
      runInAction(() => {
        for (const name of Array.from<string>(this.status.keys())) {
          if (!wanted.has(name)) {
            this.status.delete(name);
          }
        }
      });

      const cache = await this.readCache();
      // Register from cache first so Pals work immediately, then go online.
      for (const server of servers) {
        const cached = cache[server.name];
        if (
          cached &&
          cached.url === server.url &&
          !this.registered.has(server.name)
        ) {
          this.registerTools(server, cached.tools);
        }
        runInAction(() => {
          if (!this.status.has(server.name)) {
            this.status.set(server.name, {state: 'connecting'});
          }
        });
      }

      const fresh: ToolsCache = {};
      await Promise.all(
        servers.map(async server => {
          try {
            const tools = await this.clientFor(server).listTools();
            fresh[server.name] = {url: server.url, tools};
            const count = this.registerTools(server, tools);
            runInAction(() =>
              this.status.set(server.name, {state: 'ok', toolCount: count}),
            );
          } catch (e) {
            const count = this.registered.get(server.name)?.length ?? 0;
            runInAction(() =>
              this.status.set(
                server.name,
                e instanceof McpUnreachableError
                  ? {state: 'unreachable', toolCount: count}
                  : {
                      state: 'error',
                      toolCount: count,
                      message: String((e as Error)?.message ?? e),
                    },
              ),
            );
          }
        }),
      );

      const nextCache: ToolsCache = {};
      for (const server of servers) {
        const entry = fresh[server.name] ?? cache[server.name];
        if (entry) {
          nextCache[server.name] = entry;
        }
      }
      try {
        await AsyncStorage.setItem(
          MCP_TOOLS_CACHE_KEY,
          JSON.stringify(nextCache),
        );
      } catch {
        // Cache is best-effort.
      }
    } finally {
      runInAction(() => {
        this.syncing = false;
      });
    }
  }

  /** Replace this server's talents with `tools` (allowlist applied). */
  private registerTools(server: McpServerConfig, tools: McpToolInfo[]): number {
    const allow =
      server.tools && server.tools.length > 0 ? new Set(server.tools) : null;
    const selected = tools.filter(t => !allow || allow.has(t.name));
    this.unregisterServer(server.name);
    const names: string[] = [];
    for (const tool of selected) {
      const engine = new McpTalentEngine({
        serverName: server.name,
        tool,
        getClient: () => this.clientFor(server),
        approve: this.approve,
      });
      // Never overwrite anything already registered under this name: a
      // built-in, another server's talent (server `a` + tool `b_c` and server
      // `a_b` + tool `c` both map to mcp_a_b_c), or a sibling tool of this
      // server that collided after the 64-char cut. First one wins; skip + log.
      // (This server's own old talents were unregistered just above.)
      if (this.registry.has(engine.name)) {
        console.warn(
          `MCP: skipped ${server.name}/${tool.name}: talent name ${engine.name} is already taken`,
        );
        continue;
      }
      this.registry.register(engine);
      names.push(engine.name);
    }
    this.registered.set(server.name, names);
    return names.length;
  }

  private unregisterServer(serverName: string): void {
    for (const name of this.registered.get(serverName) ?? []) {
      const engine = this.registry.get(name);
      if (
        engine instanceof McpTalentEngine &&
        engine.serverName === serverName
      ) {
        this.registry.unregister(name);
      }
    }
    this.registered.delete(serverName);
  }
}

export const mcpBridge = new McpBridge({
  registry: talentRegistry,
  store: mcpServerStore,
});

let started = false;

/**
 * Called from registerDefaultTalents() (idempotent). Loads the server list,
 * registers talents, and re-syncs whenever Bo edits the list. Fire-and-forget.
 */
export function startMcpBridge(): void {
  if (started) {
    return;
  }
  started = true;
  mcpBridge.sync().catch(() => undefined);
  reaction(
    () => JSON.stringify(mcpServerStore.servers),
    () => {
      mcpBridge.sync().catch(() => undefined);
    },
  );
}
