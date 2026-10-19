import {TalentEngine, TalentResult, ToolDefinition} from '../types';
import {
  MAX_TOOL_CHARS,
  NOTES_MISSING_MESSAGE,
  NotesStore,
  focusClip,
  notesStore,
  rankNotes,
} from './NotesStore';

export class ReadNoteEngine implements TalentEngine {
  readonly name = 'read_note';
  readonly recommendedContextTokens = 500;

  constructor(private store: NotesStore = notesStore) {}

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    if (!id && !title) {
      const summary = 'read_note: provide "id" or "title"';
      return {type: 'error', summary, errorMessage: summary};
    }
    const index = await this.store.load();
    if (!index) {
      return {type: 'text', summary: NOTES_MISSING_MESSAGE};
    }

    // Small models often pass the result's list number ("2") instead of its id.
    const byNumber = /^\d{1,2}$/.test(id)
      ? this.store.lastHitIds[Number(id) - 1]
      : '';
    let noteId =
      byNumber || (id && index.notes.some(n => n.id === id) ? id : '');
    // Search terms only steer the excerpt when the note came from a search result
    // or an explicit id, not from a title lookup.
    const useTerms = !!noteId;
    if (!noteId && title) {
      const lower = title.toLowerCase();
      noteId =
        index.notes.find(n => n.title.toLowerCase() === lower)?.id ??
        rankNotes(index, title, 1)[0]?.note.id ??
        '';
    }
    if (!noteId) {
      const summary = `read_note: no note found for ${
        id ? `id "${id}"` : `title "${title}"`
      }. Try search_notes first.`;
      return {type: 'error', summary, errorMessage: summary};
    }

    const body = await this.store.readBody(noteId);
    if (body === null) {
      const summary = `read_note: note ${noteId} could not be read. Ask Claude to sync the notes again.`;
      return {type: 'error', summary, errorMessage: summary};
    }
    const meta = index.notes.find(n => n.id === noteId)!;
    const title80 = meta.title.slice(0, 80);
    return {
      type: 'text',
      summary: `${title80}\n${focusClip(
        body.trim(),
        useTerms ? this.store.lastTerms : [],
        MAX_TOOL_CHARS - title80.length - 1,
      )}`,
    };
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'read_note',
        description:
          "Read one of the user's notes by id (from search_notes) or by title.",
        parameters: {
          type: 'object',
          properties: {
            id: {type: 'string', description: 'Note id from search_notes.'},
            title: {type: 'string', description: 'Note title, if no id.'},
          },
        },
      },
    };
  }
}
