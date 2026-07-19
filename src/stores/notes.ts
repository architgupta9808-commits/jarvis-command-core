import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { formatISO } from 'date-fns';
import type { BrainNote } from '@/types';
import { idbStorage } from '@/lib/db';
import { seedNotes } from '@/lib/seed';
import { uid } from '@/lib/utils';

interface NotesState {
  notes: BrainNote[];
  addNote: (partial: Omit<BrainNote, 'id' | 'createdAt'>) => BrainNote;
  updateNote: (id: string, patch: Partial<BrainNote>) => void;
  toggleItem: (id: string, index: number) => void;
  deleteNote: (id: string) => void;
  resetToSeed: () => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: seedNotes(),

      addNote: (partial) => {
        const note: BrainNote = { ...partial, id: uid('sn'), createdAt: formatISO(new Date()) };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note;
      },
      updateNote: (id, patch) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
      toggleItem: (id, index) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id && n.items
              ? { ...n, items: n.items.map((it, i) => (i === index ? { ...it, done: !it.done } : it)) }
              : n
          ),
        })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      resetToSeed: () => set({ notes: seedNotes() }),
    }),
    { name: 'jarvis-notes', storage: createJSONStorage(() => idbStorage) }
  )
);
