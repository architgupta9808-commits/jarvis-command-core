import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { formatISO } from 'date-fns';
import type { GmailDigest } from '@/types';
import { idbStorage } from '@/lib/db';

export interface FeedbackItem {
  ts: string;
  transcript: string;
  reply: string;
  actionsSummary: string[];
}

/** Feeds published into the sync gist by the PC data engine + the self-improvement loop. */
interface LiveState {
  gmailDigest: GmailDigest | null;
  liveNodesUpdatedAt: string | null;
  /** Misfires Archit flags — the nightly job distills these into learnedRules. */
  feedbackLog: FeedbackItem[];
  /** Corrections the AI injects into its prompt. Written by the nightly job. */
  learnedRules: string[];
  setGmailDigest: (d: GmailDigest) => void;
  setLiveNodesUpdatedAt: (ts: string) => void;
  addFeedback: (item: Omit<FeedbackItem, 'ts'>) => void;
  setFeedbackLog: (log: FeedbackItem[]) => void;
  setLearnedRules: (rules: string[]) => void;
}

export const useLiveStore = create<LiveState>()(
  persist(
    (set) => ({
      gmailDigest: null,
      liveNodesUpdatedAt: null,
      feedbackLog: [],
      learnedRules: [],
      setGmailDigest: (d) => set({ gmailDigest: d }),
      setLiveNodesUpdatedAt: (ts) => set({ liveNodesUpdatedAt: ts }),
      addFeedback: (item) =>
        set((s) => ({ feedbackLog: [...s.feedbackLog, { ...item, ts: formatISO(new Date()) }].slice(-40) })),
      setFeedbackLog: (log) => set({ feedbackLog: log }),
      setLearnedRules: (rules) => set({ learnedRules: rules }),
    }),
    { name: 'jarvis-live', storage: createJSONStorage(() => idbStorage) }
  )
);
