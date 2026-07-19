import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { formatISO } from 'date-fns';
import type { BrainLink, BrainNode, Category, NodeType } from '@/types';
import { idbStorage } from '@/lib/db';
import { seedNodes } from '@/lib/seed';
import { uid } from '@/lib/utils';

export type GraphViewMode = '3d' | '2d';

export interface FocusPreset {
  id: string;
  label: string;
  query: string;
}

export const FOCUS_PRESETS: FocusPreset[] = [
  { id: 'music', label: 'Music', query: 'music' },
  { id: 'business', label: 'Business Ops', query: 'business' },
  { id: 'europe', label: 'Europe Trip', query: 'europe trip' },
  { id: 'health', label: 'Health', query: 'health' },
];

interface BrainState {
  nodes: BrainNode[];
  manualLinks: BrainLink[];
  selectedId: string | null;
  searchQuery: string;
  activeCategories: Category[]; // empty = all
  activeTypes: NodeType[]; // empty = all
  /** When set, the graph renders only the subgraph around this node/query. */
  focusQuery: string | null;
  viewMode: GraphViewMode;

  select: (id: string | null) => void;
  setSearch: (q: string) => void;
  toggleCategory: (c: Category) => void;
  toggleType: (t: NodeType) => void;
  setFocusQuery: (q: string | null) => void;
  setViewMode: (m: GraphViewMode) => void;

  addNode: (partial: Partial<BrainNode> & { title: string }) => BrainNode;
  updateNode: (id: string, patch: Partial<BrainNode>) => void;
  deleteNode: (id: string) => void;
  addManualLink: (source: string, target: string) => void;
  removeManualLink: (source: string, target: string) => void;

  importData: (nodes: BrainNode[], manualLinks: BrainLink[], merge: boolean) => void;
  resetToSeed: () => void;
}

export const useBrainStore = create<BrainState>()(
  persist(
    (set, get) => ({
      nodes: seedNodes(),
      manualLinks: [],
      selectedId: null,
      searchQuery: '',
      activeCategories: [],
      activeTypes: [],
      focusQuery: null,
      viewMode: '3d',

      select: (id) => set({ selectedId: id }),
      setSearch: (q) => set({ searchQuery: q }),
      toggleCategory: (c) =>
        set((s) => ({
          activeCategories: s.activeCategories.includes(c)
            ? s.activeCategories.filter((x) => x !== c)
            : [...s.activeCategories, c],
        })),
      toggleType: (t) =>
        set((s) => ({
          activeTypes: s.activeTypes.includes(t)
            ? s.activeTypes.filter((x) => x !== t)
            : [...s.activeTypes, t],
        })),
      setFocusQuery: (q) => set({ focusQuery: q }),
      setViewMode: (m) => set({ viewMode: m }),

      addNode: (partial) => {
        const now = formatISO(new Date());
        const node: BrainNode = {
          id: uid('node'),
          title: partial.title,
          type: partial.type ?? 'note',
          category: partial.category ?? 'ideas',
          tags: partial.tags ?? [],
          content: partial.content ?? `# ${partial.title}\n\n`,
          importance: partial.importance ?? 1,
          createdAt: now,
          updatedAt: now,
          obsidianPath: partial.obsidianPath,
        };
        set((s) => ({ nodes: [...s.nodes, node] }));
        return node;
      },

      updateNode: (id, patch) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id ? { ...n, ...patch, updatedAt: formatISO(new Date()) } : n
          ),
        })),

      deleteNode: (id) =>
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== id),
          manualLinks: s.manualLinks.filter((l) => l.source !== id && l.target !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        })),

      addManualLink: (source, target) => {
        if (source === target) return;
        const exists = get().manualLinks.some(
          (l) =>
            (l.source === source && l.target === target) ||
            (l.source === target && l.target === source)
        );
        if (!exists) set((s) => ({ manualLinks: [...s.manualLinks, { source, target, kind: 'manual' }] }));
      },

      removeManualLink: (source, target) =>
        set((s) => ({
          manualLinks: s.manualLinks.filter(
            (l) =>
              !(
                (l.source === source && l.target === target) ||
                (l.source === target && l.target === source)
              )
          ),
        })),

      importData: (nodes, manualLinks, merge) =>
        set((s) => {
          if (!merge) return { nodes, manualLinks };
          const byTitle = new Map(s.nodes.map((n) => [n.title.toLowerCase(), n]));
          const merged = [...s.nodes];
          for (const inc of nodes) {
            const hit = byTitle.get(inc.title.toLowerCase());
            if (hit) {
              const i = merged.findIndex((n) => n.id === hit.id);
              merged[i] = { ...hit, ...inc, id: hit.id };
            } else {
              merged.push(inc);
            }
          }
          return { nodes: merged, manualLinks: [...s.manualLinks, ...manualLinks] };
        }),

      resetToSeed: () => set({ nodes: seedNodes(), manualLinks: [], selectedId: null, focusQuery: null, searchQuery: '' }),
    }),
    {
      name: 'jarvis-brain',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        nodes: s.nodes,
        manualLinks: s.manualLinks,
        viewMode: s.viewMode,
      }),
    }
  )
);
