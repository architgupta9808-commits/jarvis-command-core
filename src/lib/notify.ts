import { format, parseISO } from 'date-fns';
import { useNotesStore } from '@/stores/notes';
import { useOpsStore } from '@/stores/ops';

/**
 * Local notifications. Honest model: the browser can only fire these while the app
 * (or its installed PWA) is open — foreground or backgrounded tab. True push with the
 * app fully closed needs a push server; that's a later upgrade.
 */

const FIRED_KEY = 'jarvis-fired-notifications';

export function notificationsSupported(): boolean {
  return 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

export function fireNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const opts: NotificationOptions = { body, icon: './icon.svg', badge: './icon.svg' };
  // Prefer the service worker (required on Android); fall back to the page constructor.
  navigator.serviceWorker
    ?.getRegistration()
    .then((reg) => {
      if (reg) void reg.showNotification(title, opts);
      else new Notification(title, opts);
    })
    .catch(() => {
      try {
        new Notification(title, opts);
      } catch {
        /* unsupported */
      }
    });
}

function firedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markFired(id: string) {
  const s = firedSet();
  s.add(id);
  localStorage.setItem(FIRED_KEY, JSON.stringify([...s].slice(-200)));
}

let schedulerStarted = false;

/** Once a minute: reminders fire at their time; due-today tasks fire at 09:00. */
export function initNotificationScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const tick = () => {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    const fired = firedSet();

    for (const note of useNotesStore.getState().notes) {
      if (note.format !== 'reminder' || !note.remindAt) continue;
      const at = parseISO(note.remindAt.replace(' ', 'T'));
      const id = `rem-${note.id}-${note.remindAt}`;
      if (!fired.has(id) && at <= now && now.getTime() - at.getTime() < 10 * 60 * 1000) {
        fireNotification(`⏰ ${note.title}`, note.body || 'Reminder from JARVIS');
        markFired(id);
      }
    }

    const today = format(now, 'yyyy-MM-dd');
    if (now.getHours() === 9 && now.getMinutes() < 2) {
      const due = useOpsStore.getState().tasks.filter((t) => !t.done && t.due === today);
      const id = `due-${today}`;
      if (due.length > 0 && !fired.has(id)) {
        fireNotification(
          `${due.length} task${due.length > 1 ? 's' : ''} due today`,
          due.slice(0, 3).map((t) => t.title).join(' · '),
        );
        markFired(id);
      }
    }
  };

  setInterval(tick, 60_000);
  setTimeout(tick, 4000);
}
