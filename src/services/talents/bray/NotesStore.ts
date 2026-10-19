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
  for (const tok of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
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

/**
 * Position of the rarest query term (fewest occurrences, > 0) in the body, or -1.
 * Used to show the part of a long note that actually matches the search.
 */
export function matchPosition(body: string, terms: string[]): number {
  const lower = body.toLowerCase();
  let best = -1;
  let bestCount = Infinity;
  for (const term of terms) {
    const pos = lower.indexOf(term);
    if (pos < 0) {
      continue;
    }
    let count = 1;
    for (let p = lower.indexOf(term, pos + 1); p >= 0 && count < 50; ) {
      count++;
      p = lower.indexOf(term, p + 1);
    }
    if (count < bestCount) {
      bestCount = count;
      best = pos;
    }
  }
  return best;
}

/** Like clip(), but when the note is too long, keep the head plus the part around the match. */
export function focusClip(
  body: string,
  terms: string[],
  max: number = MAX_TOOL_CHARS,
): string {
  if (body.length <= max) {
    return body;
  }
  const pos = terms.length ? matchPosition(body, terms) : -1;
  const head = 300;
  if (pos < head) {
    return clip(body, max);
  }
  const bridge = '\n…\n';
  const room = max - head - bridge.length - TRUNCATION_MARKER.length;
  const start = Math.max(head, pos - 150);
  return (
    body.slice(0, head) +
    bridge +
    body.slice(start, start + room) +
    TRUNCATION_MARKER
  );
}

/**
 * Rank notes for a query. Per matched term: dampened count x IDF (log(N/df)),
 * plus a bonus when the term is in the title; the total is multiplied up when
 * every (known) query term matched. Pure; no I/O. This deliberately replaces
 * the plan's literal "summed term weight", which buried rare-term matches.
 */
export function rankNotes(
  index: NotesIndex,
  query: string,
  limit = 5,
): NoteHit[] {
  const n = Math.max(index.notes.length, 1);
  const terms: Array<Array<[number, number]>> = [];
  const termWords: string[] = [];
  for (const term of new Set(tokenize(query))) {
    let word = term;
    let postings = index.terms[word];
    if (!postings && word.length > 3 && word.endsWith('s')) {
      word = word.slice(0, -1);
      postings = index.terms[word];
    }
    if (postings) {
      terms.push(postings);
      termWords.push(word);
    }
  }
  const scores = new Map<number, number>();
  const matched = new Map<number, number>();
  terms.forEach(postings => {
    const idf = Math.log(n / postings.length) + 0.1;
    for (const [idx, count] of postings) {
      scores.set(idx, (scores.get(idx) ?? 0) + (1 + Math.log(count)) * idf);
      matched.set(idx, (matched.get(idx) ?? 0) + 1);
    }
  });
  const ranked = [...scores.entries()].map(([idx, base]) => {
    let score = base;
    const note = index.notes[idx];
    if (note) {
      const titleToks = new Set(tokenize(note.title));
      termWords.forEach((w, i) => {
        if (titleToks.has(w)) {
          score += 4 * (Math.log(n / terms[i].length) + 0.1);
        }
      });
      if (terms.length > 1 && matched.get(idx) === terms.length) {
        score *= 1.5;
      }
    }
    return [idx, score] as [number, number];
  });
  return ranked
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
  private index: NotesIndex | null = null;
  private stamp = '';
  private loading: Promise<NotesIndex | null> | null = null;
  /** Terms of the latest search, so read_note can show the matching part of a long note. */
  lastTerms: string[] = [];

  private get dir(): string {
    return `${RNFS.ExternalDirectoryPath}/notes-db`;
  }

  /**
   * The index is re-read whenever index.json changes on disk (mtime/size), so a
   * push-notes.sh sync shows up without restarting the app. One stat per call.
   */
  load(): Promise<NotesIndex | null> {
    if (!this.loading) {
      this.loading = this.refresh().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  private async refresh(): Promise<NotesIndex | null> {
    const path = `${this.dir}/index.json`;
    try {
      const st = await RNFS.stat(path);
      const stamp = `${new Date(st.mtime as any).getTime()}:${st.size}`;
      if (this.index && stamp === this.stamp) {
        return this.index;
      }
      const parsed = JSON.parse(await RNFS.readFile(path, 'utf8'));
      if (!parsed || !Array.isArray(parsed.notes) || !parsed.terms) {
        return this.index;
      }
      this.index = parsed as NotesIndex;
      this.stamp = stamp;
      return this.index;
    } catch {
      // Missing file -> no index. A transient read error keeps the last good one.
      try {
        if (!(await RNFS.exists(path))) {
          this.index = null;
          this.stamp = '';
        }
      } catch {
        /* keep cached */
      }
      return this.index;
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

  /** Test hook / force re-read. */
  reset(): void {
    this.index = null;
    this.stamp = '';
    this.loading = null;
  }
}

export const notesStore = new NotesStore();
