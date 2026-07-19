import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GmailDigest } from '@/types';
import { idbStorage } from '@/lib/db';

/** Read-only feeds published into the sync gist by the PC-side data engine. */
interface LiveState {
  gmailDigest: GmailDigest | null;
  liveNodesUpdatedAt: string | null;
  setGmailDigest: (d: GmailDigest) => void;
  setLiveNodesUpdatedAt: (ts: string) => void;
}

export const useLiveStore = create<LiveState>()(
  persist(
    (set) => ({
      gmailDigest: null,
      liveNodesUpdatedAt: null,
      setGmailDigest: (d) => set({ gmailDigest: d }),
      setLiveNodesUpdatedAt: (ts) => set({ liveNodesUpdatedAt: ts }),
    }),
    { name: 'jarvis-live', storage: createJSONStorage(() => idbStorage) }
  )
);
