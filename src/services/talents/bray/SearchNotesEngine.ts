import {TalentEngine, TalentResult, ToolDefinition} from '../types';
import {
  NOTES_MISSING_MESSAGE,
  NoteMeta,
  NotesStore,
  MAX_TOOL_CHARS,
  clip,
  matchPosition,
  tokenize,
  notesStore,
  rankNotes,
} from './NotesStore';

const SNIPPET_CHARS = 120;
/** The best hit gets a longer excerpt so a small model can often answer without a second call. */
const TOP_SNIPPET_CHARS = 300;

export function snippetOf(
  body: string | null,
  terms: string[] = [],
  chars: number = SNIPPET_CHARS,
): string {
  const text = body ?? '';
  const pos = matchPosition(text, terms);
  // Match near the start: first chars. Otherwise a window around the match.
  const from = pos > chars ? pos - 40 : 0;
  return text
    .slice(from, from + chars * 3)
    .replace(from === 0 ? /^#+\s.*$/m : /^$/, '') // the heading usually repeats the title
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, chars);
}

/**
 * Build the result list within MAX_TOOL_CHARS without ever cutting a result mid-line.
 * The best hit's excerpt is shrunk first, then the others', and only then are whole
 * trailing results dropped.
 */
export function composeResults(
  notes: NoteMeta[],
  bodies: Array<string | null>,
  terms: string[],
  max: number = MAX_TOOL_CHARS,
): string {
  const build = (count: number, top: number, rest: number): string =>
    notes
      .slice(0, count)
      .map((note, i) => {
        const snippet = snippetOf(bodies[i], terms, i === 0 ? top : rest);
        return (
          `${i + 1}. ${note.title} (${note.folder}) [id: ${note.id}]` +
          (snippet ? `\n${snippet}` : '')
        );
      })
      .join('\n');
  const attempts: Array<[number, number]> = [
    [TOP_SNIPPET_CHARS, SNIPPET_CHARS],
    [SNIPPET_CHARS, SNIPPET_CHARS],
    [SNIPPET_CHARS, 60],
    [60, 30],
  ];
  for (let count = notes.length; count >= 1; count--) {
    for (const [top, rest] of attempts) {
      const out = build(count, top, rest);
      if (out.length <= max) {
        return out;
      }
    }
  }
  return clip(build(1, 0, 0), max);
}

export class SearchNotesEngine implements TalentEngine {
  readonly name = 'search_notes';
  readonly recommendedContextTokens = 500;

  constructor(private store: NotesStore = notesStore) {}

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      const summary = 'search_notes: missing or empty "query" argument';
      return {type: 'error', summary, errorMessage: summary};
    }
    const index = await this.store.load();
    if (!index) {
      return {type: 'text', summary: NOTES_MISSING_MESSAGE};
    }
    // Stale state from an earlier search must never leak into read_note.
    this.store.lastTerms = [];
    this.store.lastHitIds = [];
    const terms = tokenize(query);
    const hits = rankNotes(index, query, 5);
    if (hits.length === 0) {
      return {type: 'text', summary: `No notes matched "${query}".`};
    }
    this.store.lastTerms = terms;
    this.store.lastHitIds = hits.map(h => h.note.id);
    const bodies: Array<string | null> = [];
    for (const h of hits) {
      bodies.push(await this.store.readBody(h.note.id));
    }
    return {
      type: 'text',
      summary: composeResults(
        hits.map(h => h.note),
        bodies,
        terms,
      ),
    };
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'search_notes',
        description:
          "Search the user's personal notes (stored offline on this tablet). Returns the top matches with a note id; use read_note to open one.",
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Keywords to look for, e.g. "batting cage plug".',
            },
          },
          required: ['query'],
        },
      },
    };
  }
}
