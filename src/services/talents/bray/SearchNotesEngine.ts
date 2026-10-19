import {TalentEngine, TalentResult, ToolDefinition} from '../types';
import {
  NOTES_MISSING_MESSAGE,
  NotesStore,
  clip,
  notesStore,
  rankNotes,
} from './NotesStore';

const SNIPPET_CHARS = 120;

export function snippetOf(body: string | null): string {
  return (body ?? '')
    .replace(/^#+\s.*$/m, '') // the heading usually repeats the title
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SNIPPET_CHARS);
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
    const hits = rankNotes(index, query, 5);
    if (hits.length === 0) {
      return {type: 'text', summary: `No notes matched "${query}".`};
    }
    const lines: string[] = [];
    for (let i = 0; i < hits.length; i++) {
      const {note} = hits[i];
      const snippet = snippetOf(await this.store.readBody(note.id));
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
