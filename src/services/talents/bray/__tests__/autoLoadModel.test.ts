import {
  autoLoadLastUsedModel,
  BRAY_AUTOLOAD_FLAG,
  runGuardedStartupLoad,
} from '../autoLoadModel';

const gemma = {id: 'gemma'};
const store = (over = {}) => ({
  activeModelId: undefined as string | undefined,
  isContextLoading: false,
  lastUsedModel: gemma as {id: string} | undefined,
  selectModel: jest.fn(async () => {}),
  ...over,
});

describe('autoLoadLastUsedModel', () => {
  it('loads the last-used model when nothing is loaded', async () => {
    const s = store();
    expect(await autoLoadLastUsedModel(s)).toBe('gemma');
    expect(s.selectModel).toHaveBeenCalledWith(gemma);
  });

  it('does nothing when a model is active or loading, or none was used', async () => {
    for (const over of [
      {activeModelId: 'x'},
      {isContextLoading: true},
      {lastUsedModel: undefined},
    ]) {
      const s = store(over);
      expect(await autoLoadLastUsedModel(s)).toBeUndefined();
      expect(s.selectModel).not.toHaveBeenCalled();
    }
  });

  it('never throws', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const s = store({
      selectModel: jest.fn().mockRejectedValue(new Error('oom')),
    });
    expect(await autoLoadLastUsedModel(s)).toBeUndefined();
    spy.mockRestore();
  });
});

describe('runGuardedStartupLoad (crash-loop guard)', () => {
  const deps = (initial: Record<string, string> = {}, fg = true) => {
    const kv = new Map(Object.entries(initial));
    return {
      kv,
      d: {
        storage: {
          getItem: async (k: string) => kv.get(k) ?? null,
          setItem: async (k: string, v: string) => {
            kv.set(k, v);
          },
          removeItem: async (k: string) => {
            kv.delete(k);
          },
        },
        isForeground: () => fg,
        onCrashSkip: jest.fn(),
      },
    };
  };

  it('sets the flag while loading and clears it after success', async () => {
    const {kv, d} = deps();
    let during: string | undefined;
    const load = jest.fn(async () => {
      during = kv.get(BRAY_AUTOLOAD_FLAG);
    });
    expect(await runGuardedStartupLoad(d, load)).toBe('loaded');
    expect(during).toBe('true');
    expect(kv.has(BRAY_AUTOLOAD_FLAG)).toBe(false);
  });

  it('skips once when the last launch died mid-load, then loads again', async () => {
    const {kv, d} = deps({[BRAY_AUTOLOAD_FLAG]: 'true'});
    const load = jest.fn(async () => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await runGuardedStartupLoad(d, load)).toBe('skipped-after-crash');
    expect(load).not.toHaveBeenCalled();
    expect(d.onCrashSkip).toHaveBeenCalledTimes(1);
    expect(kv.has(BRAY_AUTOLOAD_FLAG)).toBe(false);
    expect(await runGuardedStartupLoad(d, load)).toBe('loaded');
    expect(load).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('a load that is killed leaves the flag set for the next launch', async () => {
    const {kv, d} = deps();
    // never resolves: the process "dies" here
    runGuardedStartupLoad(d, () => new Promise(() => {}));
    await new Promise(r => setImmediate(r));
    expect(kv.get(BRAY_AUTOLOAD_FLAG)).toBe('true');
  });

  it('does not load in the background', async () => {
    const {kv, d} = deps({}, false);
    const load = jest.fn(async () => {});
    expect(await runGuardedStartupLoad(d, load)).toBe('skipped-background');
    expect(load).not.toHaveBeenCalled();
    expect(kv.has(BRAY_AUTOLOAD_FLAG)).toBe(false);
  });

  it('clears the flag and never throws when the load rejects', async () => {
    const {kv, d} = deps();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = await runGuardedStartupLoad(d, async () => {
      throw new Error('oom');
    });
    expect(r).toBe('failed');
    expect(kv.has(BRAY_AUTOLOAD_FLAG)).toBe(false);
    spy.mockRestore();
  });
});
