import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { formatISO } from 'date-fns';
import type { BriefingData, CalendarEvent, FeedItem, Task } from '@/types';
import { idbStorage } from '@/lib/db';
import { seedEvents, seedTasks } from '@/lib/seed';
import { uid } from '@/lib/utils';

interface OpsState {
  tasks: Task[];
  events: CalendarEvent[];
  feed: FeedItem[];
  briefing: BriefingData | null;

  addTask: (partial: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  scheduleTask: (id: string, date: string, startMin: number, durationMin?: number) => void;
  unscheduleTask: (id: string) => void;

  addEvent: (partial: Partial<CalendarEvent> & { title: string; date: string; startMin: number }) => CalendarEvent;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  /** Replace all non-protected events on a date (AI replanning). */
  replaceDayPlan: (date: string, events: Omit<CalendarEvent, 'id'>[]) => void;

  clearOps: (scope: 'tasks' | 'events' | 'all') => void;
  pushFeed: (item: Omit<FeedItem, 'id' | 'ts'>) => void;
  dismissFeed: (id: string) => void;
  setBriefing: (b: BriefingData) => void;
  resetToSeed: () => void;
}

export const useOpsStore = create<OpsState>()(
  persist(
    (set) => ({
      tasks: seedTasks(),
      events: seedEvents(),
      feed: [],
      briefing: null,

      addTask: (partial) => {
        const task: Task = {
          id: uid('task'),
          title: partial.title,
          done: false,
          priority: partial.priority ?? 'normal',
          category: partial.category ?? 'personal',
          due: partial.due,
          scheduled: partial.scheduled,
          linkedNodeId: partial.linkedNodeId,
          notes: partial.notes,
          createdAt: formatISO(new Date()),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return task;
      },
      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, done: !t.done, completedAt: !t.done ? formatISO(new Date()) : undefined }
              : t
          ),
        })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      scheduleTask: (id, date, startMin, durationMin = 60) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, scheduled: { date, startMin, durationMin } } : t
          ),
        })),
      unscheduleTask: (id) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, scheduled: undefined } : t)) })),

      addEvent: (partial) => {
        const ev: CalendarEvent = {
          id: uid('ev'),
          title: partial.title,
          date: partial.date,
          startMin: partial.startMin,
          durationMin: partial.durationMin ?? 60,
          category: partial.category ?? 'personal',
          linkedNodeId: partial.linkedNodeId,
          protected: partial.protected,
        };
        set((s) => ({ events: [...s.events, ev] }));
        return ev;
      },
      updateEvent: (id, patch) =>
        set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      replaceDayPlan: (date, incoming) =>
        set((s) => ({
          events: [
            ...s.events.filter((e) => e.date !== date || e.protected),
            ...incoming.filter((e) => !e.protected).map((e) => ({ ...e, id: uid('ev') })),
          ],
        })),

      clearOps: (scope) =>
        set((s) => ({
          tasks: scope === 'events' ? s.tasks : [],
          events: scope === 'tasks' ? s.events : [],
        })),

      pushFeed: (item) =>
        set((s) => ({
          feed: [{ ...item, id: uid('feed'), ts: formatISO(new Date()) }, ...s.feed].slice(0, 60),
        })),
      dismissFeed: (id) =>
        set((s) => ({ feed: s.feed.map((f) => (f.id === id ? { ...f, dismissed: true } : f)) })),
      setBriefing: (b) => set({ briefing: b }),
      resetToSeed: () => set({ tasks: seedTasks(), events: seedEvents(), feed: [], briefing: null }),
    }),
    {
      name: 'jarvis-ops',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
