/**
 * Replays the notes-* eval queries against the REAL exported index
 * (/tmp/bray-notes/index.json from scripts/bray/notes_index.py). Skipped when the
 * index isn't there. Each target note must rank in the top 3.
 */
import * as fs from 'fs';

import {NotesIndex, rankNotes} from '../NotesStore';

const INDEX_PATH = process.env.BRAY_NOTES_INDEX ?? '/tmp/bray-notes/index.json';
const CASES: Array<[string, string]> = [
  [
    'batting cage plug',
    'Zooz Outdoor Dual Plug|Bray Farm Home Assistant Devices',
  ],
  [
    'What do my notes say about the batting cage plug?',
    'Zooz Outdoor Dual Plug|Bray Farm Home Assistant Devices',
  ],
  ['ac filter size', '18 x 20 x 1 AC Filter Size'],
  ['what size is the AC filter?', '18 x 20 x 1 AC Filter Size'],
  ['kia telluride LX trim starting price', 'Kia Telluride Trim Levels'],
  ['master bathroom air return size', 'Air return'],
  ['Kia Telluride Trim Levels', 'Kia Telluride Trim Levels'],
  ['zorbleflux', 'PocketPal Bray — notes sync check'],
];

const d = fs.existsSync(INDEX_PATH) ? describe : describe.skip;
d('ranking on the real index', () => {
  const index: NotesIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  it.each(CASES)('%s', (query, targets) => {
    const hits = rankNotes(index, query, 50);
    const ranks = targets.split('|').map(t => {
      const i = hits.findIndex(h => h.note.title.includes(t));
      return i < 0 ? 999 : i + 1;
    });
    console.log(
      `RANK ${Math.min(...ranks)}  "${query}"  (${hits[0]?.note.title})`,
    );
    expect(Math.min(...ranks)).toBeLessThanOrEqual(3);
  });
});
