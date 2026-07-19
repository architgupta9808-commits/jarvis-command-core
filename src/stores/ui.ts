import { create } from 'zustand';
import type { AIAnalysis } from '@/types';
import { uid } from '@/lib/utils';

export type AppView = 'godseye' | 'operations' | 'notes';

export type DeckStatus = 'idle' | 'listening' | 'analyzing' | 'preview' | 'executing';

export interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'alert';
}

interface UIState {
  view: AppView;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  toasts: Toast[];

  deckStatus: DeckStatus;
  transcript: string;
  interim: string;
  analysis: AIAnalysis | null;
  /** Indexes of proposed actions the user has unchecked in the preview. */
  excludedActions: Set<number>;
  deckError: string | null;

  setView: (v: AppView) => void;
  setCommandPalette: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  toast: (message: string, kind?: Toast['kind']) => void;
  removeToast: (id: string) => void;

  setDeck: (patch: Partial<Pick<UIState, 'deckStatus' | 'transcript' | 'interim' | 'analysis' | 'deckError'>>) => void;
  toggleAction: (index: number) => void;
  resetDeck: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: 'godseye',
  commandPaletteOpen: false,
  settingsOpen: false,
  toasts: [],

  deckStatus: 'idle',
  transcript: '',
  interim: '',
  analysis: null,
  excludedActions: new Set(),
  deckError: null,

  setView: (v) => set({ view: v }),
  setCommandPalette: (open) => set({ commandPaletteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  toast: (message, kind = 'info') => {
    const id = uid('toast');
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3600);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setDeck: (patch) => set((s) => ({ ...patch, excludedActions: patch.analysis !== undefined ? new Set<number>() : s.excludedActions })),
  toggleAction: (index) =>
    set((s) => {
      const next = new Set(s.excludedActions);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { excludedActions: next };
    }),
  resetDeck: () =>
    set({ deckStatus: 'idle', transcript: '', interim: '', analysis: null, deckError: null, excludedActions: new Set() }),
}));
