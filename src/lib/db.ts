import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

/** Zustand persistence backed by IndexedDB (local-first, survives large graphs). */
export const idbStorage: StateStorage = {
  getItem: async (name) => {
    const v = await get(name);
    return v ?? null;
  },
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  },
};
