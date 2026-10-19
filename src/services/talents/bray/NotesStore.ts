import * as RNFS from '@dr.pogodin/react-native-fs';

/** Tool results fed back to the model must fit n_ctx=2048. */
export const MAX_TOOL_CHARS = 1200;
export const TRUNCATION_MARKER = '\n…[truncated]';
export const NOTES_MISSING_MESSAGE =
  "Your notes aren't on the tablet yet — ask Claude to sync them.";

export interface NoteMeta {
  id: string;
  title: string;
  folder: string;
  chars: number;
}

/** Shape written by scripts/bray/notes_index.py. */
export interface NotesIndex {
  version: number;
  built: string;
  notes: NoteMeta[];
  terms: Record<string, Array<[number, number]>>;
}

export interface NoteHit {
  note: NoteMeta;
  score: number;
}

const STOP_WORDS = new Set(
  (
    'the and for are but not you all any can had her was one our out has have ' +
    'his how its may new now old see two way who did get let put say she too use ' +
    'that this with from they will would there their what when which about into ' +
    'than then them these those been being were your yours also just like some ' +
    'such only over very more most other each both does done here where while ' +
    'http https www com org net html my notes note'
  ).split(' '),
);

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const tok of text.toLowerCase().match(/[a-z0-9À-￿]+/g) ?? []) {
    if (tok.length >= 3 && tok.length <= 24 && !STOP_WORDS.has(tok)) {
      out.push(tok);
    }
  }
  return out;
}

export function clip(text: string, max: number = MAX_TOOL_CHARS): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;
}

/** Rank notes by summed term weight for the query. Pure; no I/O. */
export function rankNotes(
  index: NotesIndex,
  query: string,
  limit = 5,
): NoteHit[] {
  const scores = new Map<number, number>();
  for (const term of new Set(tokenize(query))) {
    let postings = index.terms[term];
    if (!postings && term.length > 3 && term.endsWith('s')) {
      postings = index.terms[term.slice(0, -1)];
    }
    for (const [idx, count] of postings ?? []) {
      scores.set(idx, (scores.get(idx) ?? 0) + count);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit)
    .map(([idx, score]) => ({note: index.notes[idx], score}))
    .filter(h => !!h.note);
}

/**
 * Offline copy of Bo's Joplin notes, pushed to the app's external files dir by
 * scripts/bray/push-notes.sh. The index is read once and cached; note bodies
 * are read on demand.
 */
export class NotesStore {
  private index: NotesIndex | null | undefined;
  private loading: Promise<NotesIndex | null> | null = null;

  private get dir(): string {
    return `${RNFS.ExternalDirectoryPath}/notes-db`;
  }

  load(): Promise<NotesIndex | null> {
    if (this.index !== undefined) {
      return Promise.resolve(this.index);
    }
    if (!this.loading) {
      this.loading = this.readIndex().then(idx => {
        // A missing index is not cached, so a sync that lands later is picked up.
        if (idx) {
          this.index = idx;
        }
        this.loading = null;
        return idx;
      });
    }
    return this.loading;
  }

  private async readIndex(): Promise<NotesIndex | null> {
    try {
      const path = `${this.dir}/index.json`;
      if (!(await RNFS.exists(path))) {
        return null;
      }
      const parsed = JSON.parse(await RNFS.readFile(path, 'utf8'));
      if (!parsed || !Array.isArray(parsed.notes) || !parsed.terms) {
        return null;
      }
      return parsed as NotesIndex;
    } catch {
      return null;
    }
  }

  /** Body of a note, or null when the id is unknown or the file is missing. */
  async readBody(id: string): Promise<string | null> {
    const index = await this.load();
    // Only ids from the index reach the filesystem (no path tricks).
    if (!index || !index.notes.some(n => n.id === id)) {
      return null;
    }
    try {
      return await RNFS.readFile(`${this.dir}/notes/${id}.md`, 'utf8');
    } catch {
      return null;
    }
  }

  /** Test hook / force re-read after a sync. */
  reset(): void {
    this.index = undefined;
    this.loading = null;
  }
}

export const notesStore = new NotesStore();
