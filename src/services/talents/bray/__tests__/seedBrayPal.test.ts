import {
  BRAY_PROMPT_KEY,
  BRAY_SEEDED_KEY,
  BRAY_SYSTEM_PROMPT,
  BRAY_SYSTEM_PROMPT_V1,
  BRAY_TALENTS,
  seedBrayPal,
  type NewPal,
  type SeedDeps,
} from '../seedBrayPal';
import type {Pal} from '../../../../types/pal';

function makeDeps(initialPals: Pal[] = [], seeded: string | null = null) {
  const store = new Map<string, string>();
  if (seeded !== null) {
    store.set(BRAY_SEEDED_KEY, seeded);
  }
  const pals: Pal[] = [...initialPals];
  const createPal = jest.fn(async (p: NewPal) => {
    pals.push({...p, id: `id-${pals.length}`} as Pal);
  });
  const deps: SeedDeps = {
    storage: {
      getItem: async k => (store.has(k) ? store.get(k)! : null),
      setItem: async (k, v) => {
        store.set(k, v);
      },
    },
    pals: () => pals,
    createPal,
  };
  return {deps, store, pals, createPal};
}

describe('seedBrayPal', () => {
  it('creates the Bray Pal with all tablet and notes talents on first launch', async () => {
    const {deps, store, createPal} = makeDeps();
    expect(await seedBrayPal(deps)).toBe(true);
    expect(createPal).toHaveBeenCalledTimes(1);
    const pal = createPal.mock.calls[0][0];
    expect(pal.name).toBe('Bray');
    expect(pal.systemPrompt).toBe(BRAY_SYSTEM_PROMPT);
    expect(pal.systemPrompt).toBe(
      "You are Bo's offline tablet assistant. Use a tool when the question is about this tablet or Bo's notes; otherwise answer directly. Keep answers short. For questions about Bo's notes, call search_notes, then call read_note on the best hit before answering.",
    );
    expect(pal.pact?.talents.map(t => t.name)).toEqual([...BRAY_TALENTS]);
    expect(pal.pact?.talents.map(t => t.name).sort()).toEqual(
      [
        'read_note',
        'search_notes',
        'tablet_list_files',
        'tablet_open_app',
        'tablet_set_brightness',
        'tablet_shell',
        'tablet_status',
      ].sort(),
    );
    expect(pal.pact?.talents.some(t => t.name.startsWith('mcp_'))).toBe(false);
    expect(store.get(BRAY_SEEDED_KEY)).toBe('true');
  });

  it('runs only once', async () => {
    const {deps, createPal, pals} = makeDeps();
    await seedBrayPal(deps);
    expect(await seedBrayPal(deps)).toBe(false);
    expect(createPal).toHaveBeenCalledTimes(1);
    expect(pals.filter(p => p.name === 'Bray')).toHaveLength(1);
  });

  it('does not re-create the Pal after Bo deletes it (flag already set)', async () => {
    const {deps, createPal} = makeDeps([], 'true');
    expect(await seedBrayPal(deps)).toBe(false);
    expect(createPal).not.toHaveBeenCalled();
  });

  it('adopts an existing local "Bray" Pal instead of duplicating it', async () => {
    const existing = {name: 'Bray', source: 'local', id: 'x'} as Pal;
    const {deps, store, createPal} = makeDeps([existing]);
    expect(await seedBrayPal(deps)).toBe(false);
    expect(createPal).not.toHaveBeenCalled();
    expect(store.get(BRAY_SEEDED_KEY)).toBe('true');
  });

  it('leaves the flag unset and does not throw when creating fails', async () => {
    const {deps, store} = makeDeps();
    deps.createPal = jest.fn().mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await seedBrayPal(deps)).toBe(false);
    expect(store.has(BRAY_SEEDED_KEY)).toBe(false);
    spy.mockRestore();
  });
});

describe('untinting an existing Bray Pal', () => {
  it('clears the v1 colour once', async () => {
    const tinted = {
      id: 'b',
      name: 'Bray',
      source: 'local',
      color: ['#13A1EE', '#FAFAFA'],
    } as unknown as Pal;
    const {deps, store} = makeDeps([tinted], 'true');
    const updatePal = jest.fn(async () => {});
    deps.updatePal = updatePal;
    await seedBrayPal(deps);
    await seedBrayPal(deps);
    expect(updatePal).toHaveBeenCalledTimes(1);
    expect(updatePal).toHaveBeenCalledWith('b', {color: null});
    expect(store.get('bray.untinted.v1')).toBe('true');
  });

  it('a fresh Bray Pal has no colour', async () => {
    const {deps, createPal} = makeDeps();
    await seedBrayPal(deps);
    expect(createPal.mock.calls[0][0].color).toBeUndefined();
  });
});

describe('upgrading the Bray prompt', () => {
  it('replaces an unedited v1 prompt once', async () => {
    const v1 = {
      id: 'b',
      name: 'Bray',
      source: 'local',
      systemPrompt: BRAY_SYSTEM_PROMPT_V1,
    } as unknown as Pal;
    const {deps, store} = makeDeps([v1], 'true');
    const updatePal = jest.fn(async () => {});
    deps.updatePal = updatePal;
    await seedBrayPal(deps);
    await seedBrayPal(deps);
    expect(updatePal).toHaveBeenCalledTimes(1);
    expect(updatePal).toHaveBeenCalledWith('b', {
      systemPrompt: BRAY_SYSTEM_PROMPT,
      originalSystemPrompt: BRAY_SYSTEM_PROMPT,
    });
    expect(store.get(BRAY_PROMPT_KEY)).toBe('true');
  });

  it('leaves a prompt Bo edited alone', async () => {
    const edited = {
      id: 'b',
      name: 'Bray',
      source: 'local',
      systemPrompt: 'my own prompt',
    } as unknown as Pal;
    const {deps} = makeDeps([edited], 'true');
    const updatePal = jest.fn(async () => {});
    deps.updatePal = updatePal;
    await seedBrayPal(deps);
    expect(updatePal).not.toHaveBeenCalled();
  });
});
