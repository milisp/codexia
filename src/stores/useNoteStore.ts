import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import type { NoteSummary } from '@/hooks/useNotes';
import { createNote, getNotes } from '@/services/tauri';

type NoteViewMode = 'list' | 'editor';

interface NoteStore {
  selectedNoteId: string | null;
  viewMode: NoteViewMode;
  notes: NoteSummary[];
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  setSelectedNoteId: (noteId: string | null) => void;
  setViewMode: (viewMode: NoteViewMode) => void;
  openEditor: (noteId: string | null) => void;
  closeEditor: () => void;
  loadNotes: () => Promise<void>;
  addNote: (content: string, tags?: string[]) => Promise<string>;
}

const getPreview = (content: string) => {
  const lines = content.split(/\r?\n/);
  return lines.slice(1).join(' ').trim().substring(0, 100) || 'No additional content';
};

export const useNoteStore = create<NoteStore>((set, get) => ({
  selectedNoteId: null,
  viewMode: 'list',
  notes: [],
  loading: false,
  error: null,
  hasLoaded: false,

  setSelectedNoteId: (noteId) => set({ selectedNoteId: noteId }),
  setViewMode: (viewMode) => set({ viewMode }),
  openEditor: (noteId) => set({ selectedNoteId: noteId, viewMode: 'editor' }),
  closeEditor: () => set({ viewMode: 'list' }),

  loadNotes: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const dbNotes = await getNotes(null);
      const notes = dbNotes.map((note) => ({
        id: note.id,
        title: note.title || 'Untitled note',
        preview: getPreview(note.content),
        tags: note.tags ?? [],
        mtime: Date.parse(note.updated_at) || 0,
        isFavorited: note.is_favorited,
      }));
      set({ notes, hasLoaded: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message || 'Failed to load notes.' });
    } finally {
      set({ loading: false });
    }
  },

  addNote: async (content, tags) => {
    const id = uuidv4();
    const firstLine = content.split(/\r?\n/)[0] || '';
    const title = firstLine.replace(/^#+\s*/, '').trim() || 'Untitled note';
    await createNote(id, title, content, tags ?? []);
    await get().loadNotes();
    return id;
  },
}));
