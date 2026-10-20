// Bray fork: Bo should never have to load a model. On a cold start, if no
// model is active (and upstream's auto-release reload did not bring one back),
// load the last model he used. Never throws.
interface ModelLike {
  id: string;
}

export interface AutoLoadStore<M extends ModelLike> {
  activeModelId: string | undefined;
  isContextLoading: boolean;
  lastUsedModel: M | undefined;
  selectModel: (model: M) => Promise<void>;
}

/** Returns the id it started loading, or undefined. */
export async function autoLoadLastUsedModel<M extends ModelLike>(
  store: AutoLoadStore<M>,
): Promise<string | undefined> {
  try {
    const model = store.lastUsedModel;
    if (store.activeModelId || store.isContextLoading || !model) {
      return undefined;
    }
    await store.selectModel(model);
    return model.id;
  } catch (error) {
    console.error('Bray: auto-loading the last model failed:', error);
    return undefined;
  }
}

// Crash-loop guard. If a model is too big, the low-memory killer can kill the
// app while it loads; the next launch would load it again, forever, and the
// model picker would never be reachable. So: mark the startup load as in
// progress, clear the mark after it finishes, and if a launch finds the mark
// still set (the last one died mid-load), skip the startup load once.
export const BRAY_AUTOLOAD_FLAG = 'bray.autoload.inProgress';

export interface StartupLoadDeps {
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  /** True when the app is in the foreground. */
  isForeground: () => boolean;
  /** Called when the load is skipped after a crash (e.g. clear reload flags). */
  onCrashSkip?: () => void;
}

export type StartupLoadResult =
  | 'loaded'
  | 'skipped-after-crash'
  | 'skipped-background'
  | 'failed';

/** Runs the startup model load behind the crash-loop guard. Never throws. */
export async function runGuardedStartupLoad(
  deps: StartupLoadDeps,
  load: () => Promise<unknown>,
): Promise<StartupLoadResult> {
  try {
    if ((await deps.storage.getItem(BRAY_AUTOLOAD_FLAG)) === 'true') {
      await deps.storage.removeItem(BRAY_AUTOLOAD_FLAG);
      console.warn(
        'Bray: the last launch died while loading a model; not auto-loading this time.',
      );
      deps.onCrashSkip?.();
      return 'skipped-after-crash';
    }
    if (!deps.isForeground()) {
      return 'skipped-background';
    }
    await deps.storage.setItem(BRAY_AUTOLOAD_FLAG, 'true');
  } catch (error) {
    console.error('Bray: auto-load guard failed:', error);
    return 'failed';
  }
  try {
    await load();
    return 'loaded';
  } catch (error) {
    console.error('Bray: startup model load failed:', error);
    return 'failed';
  } finally {
    // A JS-level failure is not a crash: clear the mark either way.
    await deps.storage.removeItem(BRAY_AUTOLOAD_FLAG).catch(() => {});
  }
}
