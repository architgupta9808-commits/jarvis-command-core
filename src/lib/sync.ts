import { formatISO } from 'date-fns';
import type { BrainLink, BrainNode, BrainNote, CalendarEvent, FeedItem, Task } from '@/types';
import { useBrainStore } from '@/stores/brain';
import { useOpsStore } from '@/stores/ops';
import { useNotesStore } from '@/stores/notes';
import { useSettingsStore } from '@/stores/settings';

/**
 * Cross-device sync over a secret GitHub Gist.
 *
 * Zero infrastructure: the user pastes a GitHub token (classic, `gist` scope only)
 * on each device. The app keeps one secret gist as the source of truth and does
 * last-write-wins on the whole bundle — whichever device changed most recently
 * overwrites the gist; devices that are behind pull it. Auto-sync runs on startup,
 * every 90 s, and ~8 s after any local change.
 */

const GIST_DESC = 'JARVIS Command Core sync — managed by the app, do not edit';
const FILE = 'jarvis-sync.json';

interface SyncBundle {
  version: 1;
  exportedAt: string;
  nodes: BrainNode[];
  manualLinks: BrainLink[];
  tasks: Task[];
  events: CalendarEvent[];
  feed: FeedItem[];
  notes: BrainNote[];
}

let applying = false;
let dirtyAt = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let lastResult = 'never synced';

export function getSyncStatus(): string {
  return lastResult;
}

function buildBundle(): SyncBundle {
  const b = useBrainStore.getState();
  const o = useOpsStore.getState();
  const n = useNotesStore.getState();
  return {
    version: 1,
    exportedAt: formatISO(new Date()),
    nodes: b.nodes,
    manualLinks: b.manualLinks,
    tasks: o.tasks,
    events: o.events,
    feed: o.feed,
    notes: n.notes,
  };
}

function applyBundle(bundle: SyncBundle) {
  applying = true;
  try {
    useBrainStore.setState({ nodes: bundle.nodes, manualLinks: bundle.manualLinks });
    useOpsStore.setState({ tasks: bundle.tasks, events: bundle.events, feed: bundle.feed ?? [] });
    useNotesStore.setState({ notes: bundle.notes ?? [] });
  } finally {
    // Let the persistence writes settle before re-arming the dirty tracker.
    setTimeout(() => {
      applying = false;
      dirtyAt = 0;
    }, 50);
  }
}

async function gh(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

async function ensureGist(token: string): Promise<string> {
  const { syncGistId } = useSettingsStore.getState();
  if (syncGistId) return syncGistId;

  const list = await gh(token, '/gists?per_page=100');
  if (list.ok) {
    const gists = (await list.json()) as { id: string; description: string }[];
    const hit = gists.find((g) => g.description === GIST_DESC);
    if (hit) {
      useSettingsStore.getState().set({ syncGistId: hit.id });
      return hit.id;
    }
  }
  const created = await gh(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_DESC,
      public: false,
      files: { [FILE]: { content: JSON.stringify(buildBundle()) } },
    }),
  });
  if (!created.ok) throw new Error(`Could not create sync gist (${created.status})`);
  const gist = (await created.json()) as { id: string };
  useSettingsStore.getState().set({ syncGistId: gist.id });
  return gist.id;
}

export async function syncNow(): Promise<{ ok: boolean; msg: string }> {
  const { syncToken, lastSyncAt } = useSettingsStore.getState();
  if (!syncToken) return { ok: false, msg: 'No sync token set' };
  try {
    const id = await ensureGist(syncToken);
    const res = await gh(syncToken, `/gists/${id}`);
    if (!res.ok) throw new Error(`Gist fetch failed (${res.status})`);
    const gist = (await res.json()) as {
      files: Record<string, { content: string; truncated: boolean; raw_url: string }>;
    };
    const file = gist.files[FILE];
    let remote: SyncBundle | null = null;
    if (file) {
      const raw = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
      try {
        remote = JSON.parse(raw) as SyncBundle;
      } catch {
        remote = null;
      }
    }

    const remoteAt = remote ? Date.parse(remote.exportedAt) : 0;
    const syncedAt = lastSyncAt ? Date.parse(lastSyncAt) : 0;
    const localChanged = dirtyAt > 0;
    const remoteChanged = remoteAt > syncedAt;

    let msg: string;
    if (remoteChanged && (!localChanged || remoteAt > dirtyAt)) {
      applyBundle(remote!);
      msg = 'Pulled newer data from your other device';
    } else if (localChanged || !remote) {
      const patch = await gh(syncToken, `/gists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(buildBundle()) } } }),
      });
      if (!patch.ok) throw new Error(`Push failed (${patch.status})`);
      dirtyAt = 0;
      msg = 'Pushed local changes to the cloud';
    } else {
      msg = 'Already in sync';
    }
    useSettingsStore.getState().set({ lastSyncAt: formatISO(new Date()) });
    lastResult = `${msg} · ${new Date().toLocaleTimeString()}`;
    return { ok: true, msg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    lastResult = `✗ ${msg} · ${new Date().toLocaleTimeString()}`;
    console.warn('[JARVIS sync]', err);
    return { ok: false, msg };
  }
}

function scheduleDebouncedSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const { autoSync, syncToken } = useSettingsStore.getState();
    if (autoSync && syncToken) void syncNow();
  }, 8000);
}

export function initSync() {
  if (started) return;
  started = true;
  const markDirty = () => {
    if (applying) return;
    dirtyAt = Date.now();
    scheduleDebouncedSync();
  };
  useBrainStore.subscribe(markDirty);
  useOpsStore.subscribe(markDirty);
  useNotesStore.subscribe(markDirty);

  const kick = () => {
    const { autoSync, syncToken } = useSettingsStore.getState();
    if (autoSync && syncToken) void syncNow();
  };
  setTimeout(kick, 2500); // after store hydration
  setInterval(kick, 90_000);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick(); // returning to the app → pull fresh
  });
}
