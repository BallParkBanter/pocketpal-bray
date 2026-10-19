import * as RNFS from '@dr.pogodin/react-native-fs';

import {
  MAX_TOOL_CHARS,
  NOTES_MISSING_MESSAGE,
  NotesIndex,
  NotesStore,
} from '../NotesStore';
import {SearchNotesEngine} from '../SearchNotesEngine';
import {ReadNoteEngine} from '../ReadNoteEngine';
import {rankNotes, tokenize} from '../NotesStore';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  ExternalDirectoryPath: '/ext',
  exists: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
}));

const fsMock = RNFS as jest.Mocked<typeof RNFS>;

const INDEX: NotesIndex = {
  version: 1,
  built: '2026-10-19T00:00:00Z',
  notes: [
    {id: 'aaa', title: 'Batting Cage', folder: 'Bray Farm', chars: 50},
    {id: 'bbb', title: 'HA devices', folder: 'Smart Home', chars: 5000},
    {id: 'ccc', title: 'Groceries', folder: 'Food', chars: 10},
  ],
  terms: {
    batting: [[0, 6]],
    cage: [[0, 8]],
    plug: [
      [0, 1],
      [1, 2],
    ],
    zen14: [[1, 3]],
    groceries: [[2, 6]],
  },
};
const BODIES: Record<string, string> = {
  '/ext/notes-db/notes/aaa.md':
    '# Batting Cage\nThe cage plug is on the east wall.',
  '/ext/notes-db/notes/bbb.md': 'x'.repeat(5000),
  '/ext/notes-db/notes/ccc.md': 'milk eggs',
};

function present(mtime = 1000) {
  fsMock.exists.mockResolvedValue(true);
  (fsMock.stat as jest.Mock).mockResolvedValue({
    mtime: new Date(mtime),
    size: 10,
  });
  fsMock.readFile.mockImplementation(async (p: string) => {
    if (p === '/ext/notes-db/index.json') {
      return JSON.stringify(INDEX);
    }
    if (p in BODIES) {
      return BODIES[p];
    }
    throw new Error('ENOENT');
  });
}

beforeEach(() => jest.clearAllMocks());

describe('search_notes', () => {
  it('ranks the batting-cage note first with the contract format', async () => {
    present();
    const r = await new SearchNotesEngine(new NotesStore()).execute({
      query: 'batting cage plug',
    });
    expect(r.type).toBe('text');
    expect(
      r.summary.startsWith('1. Batting Cage (Bray Farm) [id: aaa]\n'),
    ).toBe(true);
    expect(r.summary).toContain('2. HA devices (Smart Home) [id: bbb]');
    expect(r.summary.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
  });

  it('returns the exact missing-index message', async () => {
    fsMock.exists.mockResolvedValue(false);
    (fsMock.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    const r = await new SearchNotesEngine(new NotesStore()).execute({
      query: 'anything',
    });
    expect(r.summary).toBe(
      "Your notes aren't on the tablet yet — ask Claude to sync them.",
    );
    expect(r.summary).toBe(NOTES_MISSING_MESSAGE);
  });

  it('reads the index only once', async () => {
    present();
    const engine = new SearchNotesEngine(new NotesStore());
    await engine.execute({query: 'cage'});
    await engine.execute({query: 'groceries'});
    const indexReads = fsMock.readFile.mock.calls.filter(c =>
      String(c[0]).endsWith('index.json'),
    );
    expect(indexReads).toHaveLength(1);
  });

  it('handles no match and empty query', async () => {
    present();
    const engine = new SearchNotesEngine(new NotesStore());
    expect((await engine.execute({query: 'zzzz'})).summary).toMatch(/No notes/);
    expect((await engine.execute({query: ' '})).type).toBe('error');
  });
});

describe('read_note', () => {
  it('reads by id', async () => {
    present();
    const r = await new ReadNoteEngine(new NotesStore()).execute({id: 'ccc'});
    expect(r.summary).toBe('Groceries\nmilk eggs');
  });

  it('reads by title, case-insensitive exact', async () => {
    present();
    const r = await new ReadNoteEngine(new NotesStore()).execute({
      title: 'batting CAGE',
    });
    expect(r.summary).toContain('east wall');
  });

  it('falls back to the best search hit for a fuzzy title', async () => {
    present();
    const r = await new ReadNoteEngine(new NotesStore()).execute({
      title: 'zen14 plug',
    });
    expect(r.summary.startsWith('HA devices')).toBe(true);
  });

  it('truncates long notes with a marker within the limit', async () => {
    present();
    const r = await new ReadNoteEngine(new NotesStore()).execute({id: 'bbb'});
    expect(r.summary.length).toBe(MAX_TOOL_CHARS);
    expect(r.summary.endsWith('…[truncated]')).toBe(true);
  });

  it('refuses ids that are not in the index and reports a missing index', async () => {
    present();
    const engine = new ReadNoteEngine(new NotesStore());
    expect((await engine.execute({id: '../../etc/passwd'})).type).toBe('error');
    fsMock.exists.mockResolvedValue(false);
    (fsMock.stat as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    expect(
      (await new ReadNoteEngine(new NotesStore()).execute({id: 'aaa'})).summary,
    ).toBe(NOTES_MISSING_MESSAGE);
  });
});

describe('NotesStore reload', () => {
  it('re-reads index.json when its mtime changes, not otherwise', async () => {
    present(1000);
    const store = new NotesStore();
    await store.load();
    await store.load();
    const reads = () =>
      fsMock.readFile.mock.calls.filter(c =>
        String(c[0]).endsWith('index.json'),
      ).length;
    expect(reads()).toBe(1);
    present(2000);
    await store.load();
    expect(reads()).toBe(2);
  });
});

describe('rankNotes (IDF)', () => {
  // 50 notes; "size" is everywhere, "filter" is rarer, "zebra" unique.
  const notes = Array.from({length: 50}, (_, i) => ({
    id: `n${i}`,
    title: i === 7 ? 'AC Filter Size' : `Other ${i}`,
    folder: 'F',
    chars: 10,
  }));
  const index: NotesIndex = {
    version: 1,
    built: 'x',
    notes,
    terms: {
      size: notes.map((_, i) => [i, i === 7 ? 6 : 12] as [number, number]),
      filter: [
        [7, 6],
        [3, 4],
      ],
      zebra: [[20, 1]],
    },
  };
  it('puts the title-matching rare-term note first despite higher raw counts elsewhere', () => {
    expect(rankNotes(index, 'ac filter size')[0].note.id).toBe('n7');
  });
  it('finds a unique term in a note', () => {
    expect(rankNotes(index, 'zebra')[0].note.id).toBe('n20');
  });
  it('tokenizes unicode letters, not punctuation', () => {
    expect(tokenize('café — “quoted”')).toEqual(['café', 'quoted']);
  });
});
