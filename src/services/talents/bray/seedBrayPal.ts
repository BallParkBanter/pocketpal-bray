// Bray fork: seed the one "Bray" Pal (all tablet_* talents + offline notes)
// on first launch. Guarded by an AsyncStorage key so a Pal Bo renames or
// deletes is never re-created. MCP talents are deliberately left out: too many
// tools for a 2B model, and the offline notes cover the same need.
import type {Pal} from '../../../types/pal';

export const BRAY_SEEDED_KEY = 'bray.seeded.v1';
export const BRAY_PAL_NAME = 'Bray';

export const BRAY_SYSTEM_PROMPT =
  "You are Bo's offline tablet assistant. Use a tool when the question is about this tablet or Bo's notes; otherwise answer directly. Keep answers short.";

export const BRAY_TALENTS = [
  'tablet_status',
  'tablet_set_brightness',
  'tablet_open_app',
  'tablet_list_files',
  'tablet_shell',
  'search_notes',
  'read_note',
] as const;

export type NewPal = Omit<Pal, 'id' | 'created_at' | 'updated_at'>;

export interface SeedDeps {
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  pals: () => Pal[];
  createPal: (pal: NewPal) => Promise<unknown>;
}

export function brayPalData(): NewPal {
  return {
    type: 'local',
    name: BRAY_PAL_NAME,
    description:
      "Bo's offline tablet assistant: tablet status, brightness, apps, files, shell and Bo's notes.",
    systemPrompt: BRAY_SYSTEM_PROMPT,
    originalSystemPrompt: BRAY_SYSTEM_PROMPT,
    isSystemPromptChanged: false,
    useAIPrompt: false,
    defaultModel: undefined,
    parameters: {},
    parameterSchema: [],
    capabilities: {tools: true},
    color: ['#13A1EE', '#FAFAFA'],
    source: 'local',
    pact: {
      talents: BRAY_TALENTS.map(name => ({name, necessity: 'required'})),
    },
  };
}

/** Returns true when it created the Pal. Never throws. */
export async function seedBrayPal(deps: SeedDeps): Promise<boolean> {
  try {
    if ((await deps.storage.getItem(BRAY_SEEDED_KEY)) === 'true') {
      return false;
    }
    const exists = deps
      .pals()
      .some(p => p.name === BRAY_PAL_NAME && p.source === 'local');
    if (!exists) {
      await deps.createPal(brayPalData());
    }
    await deps.storage.setItem(BRAY_SEEDED_KEY, 'true');
    return !exists;
  } catch (error) {
    console.error('Error seeding Bray pal:', error);
    return false;
  }
}
