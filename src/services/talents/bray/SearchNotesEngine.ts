import {TalentEngine, TalentResult, ToolDefinition} from '../types';
import {
  NOTES_MISSING_MESSAGE,
  NotesStore,
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
    this.store.lastTerms = tokenize(query);
    const hits = rankNotes(index, query, 5);
    if (hits.length === 0) {
      return {type: 'text', summary: `No notes matched "${query}".`};
    }
    this.store.lastHitIds = hits.map(h => h.note.id);
    const lines: string[] = [];
    for (let i = 0; i < hits.length; i++) {
      const {note} = hits[i];
      const snippet = snippetOf(
        await this.store.readBody(note.id),
        this.store.lastTerms,
        i === 0 ? TOP_SNIPPET_CHARS : SNIPPET_CHARS,
      );
      lines.push(
        `${i + 1}. ${note.title} (${note.folder}) [id: ${note.id}]` +
          (snippet ? `\n${snippet}` : ''),
      );
    }
    return {type: 'text', summary: clip(lines.join('\n'))};
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
