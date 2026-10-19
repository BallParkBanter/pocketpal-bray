import {TalentEngine, TalentResult, ToolDefinition} from '../types';
import {
  NOTES_MISSING_MESSAGE,
  NotesStore,
  clip,
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

    let noteId = id && index.notes.some(n => n.id === id) ? id : '';
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
    return {type: 'text', summary: clip(`${meta.title}\n${body.trim()}`)};
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
