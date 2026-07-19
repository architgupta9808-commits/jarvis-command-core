import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { CalendarClock, Check, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useOpsStore } from '@/stores/ops';
import { useBrainStore } from '@/stores/brain';
import { useUIStore } from '@/stores/ui';
import type { Task } from '@/types';
import { CATEGORY_META, cn, PRIORITY_META } from '@/lib/utils';

/** Smart prioritised to-do list. Drag rows onto the Timeline to schedule them. */
export const TaskList = memo(function TaskList() {
  const tasks = useOpsStore((s) => s.tasks);
  const addTask = useOpsStore((s) => s.addTask);
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);

  const sorted = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const score = (t: Task) => {
      let v = PRIORITY_META[t.priority].weight * 10;
      if (t.due && t.due < today) v -= 25; // overdue floats to top
      else if (t.due === today) v -= 15;
      else if (t.due) v -= 5;
      return v;
    };
    const open = tasks.filter((t) => !t.done).sort((a, b) => score(a) - score(b));
    const done = tasks.filter((t) => t.done);
    return showDone ? [...open, ...done] : open;
  }, [tasks, showDone]);

  const submit = () => {
    if (!draft.trim()) return;
    addTask({ title: draft.trim() });
    setDraft('');
  };

  return (
    <div className="glass glass-hover flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="hud-label text-holo">Mission Queue</span>
        <button onClick={() => setShowDone((v) => !v)} className="font-mono text-[10px] text-steel hover:text-ice">
          {showDone ? 'hide done' : 'show done'}
        </button>
      </div>
      <div className="flex gap-2 border-b border-white/10 px-3 py-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="New task…"
          className="flex-1 !py-1.5 text-xs"
          aria-label="New task title"
        />
        <button onClick={submit} disabled={!draft.trim()} className="btn-holo disabled:opacity-40" aria-label="Add task">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        <AnimatePresence initial={false}>
          {sorted.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </AnimatePresence>
        {sorted.length === 0 && <li className="px-2 py-6 text-center text-xs text-steel">Queue clear. Enjoy it while it lasts, Sir.</li>}
      </ul>
    </div>
  );
});

/** Touch devices can't use HTML5 drag — give them a one-tap "next free hour today" scheduler. */
function scheduleAtNextFreeSlot(taskId: string) {
  const { events, tasks, scheduleTask } = useOpsStore.getState();
  const today = format(new Date(), 'yyyy-MM-dd');
  const busy: [number, number][] = [
    ...events.filter((e) => e.date === today).map((e): [number, number] => [e.startMin, e.startMin + e.durationMin]),
    ...tasks
      .filter((t) => t.scheduled?.date === today && !t.done && t.id !== taskId)
      .map((t): [number, number] => [t.scheduled!.startMin, t.scheduled!.startMin + t.scheduled!.durationMin]),
  ];
  let candidate = Math.max(7 * 60, (Math.floor((new Date().getHours() * 60 + new Date().getMinutes()) / 60) + 1) * 60);
  while (candidate <= 21 * 60 && busy.some(([a, b]) => candidate < b && candidate + 60 > a)) candidate += 30;
  scheduleTask(taskId, today, Math.min(candidate, 21 * 60));
  useUIStore.getState().toast(`Scheduled today at ${Math.floor(candidate / 60)}:${String(candidate % 60).padStart(2, '0')}`, 'success');
}

const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const TaskRow = memo(function TaskRow({ task }: { task: Task }) {
  const toggleTask = useOpsStore((s) => s.toggleTask);
  const deleteTask = useOpsStore((s) => s.deleteTask);
  const select = useBrainStore((s) => s.select);
  const setView = useUIStore((s) => s.setView);
  const pMeta = PRIORITY_META[task.priority];
  const cMeta = CATEGORY_META[task.category];
  const today = format(new Date(), 'yyyy-MM-dd');
  const overdue = !task.done && task.due && task.due < today;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
      draggable={!task.done}
      onDragStart={(e) => {
        (e as unknown as React.DragEvent).dataTransfer?.setData('application/x-jarvis-task', task.id);
      }}
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-white/10 hover:bg-white/5',
        !task.done && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-steel/40 opacity-0 transition-opacity group-hover:opacity-100" />
      <button
        aria-label={task.done ? 'Mark not done' : 'Mark done'}
        onClick={() => toggleTask(task.id)}
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded border transition-all',
          task.done ? 'border-holo/60 bg-holo/20' : 'border-white/25 hover:border-holo/60'
        )}
      >
        {task.done && <Check className="h-3 w-3 text-holo" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-xs', task.done ? 'text-steel/60 line-through' : 'text-ice')}>{task.title}</p>
        <div className="flex items-center gap-2 font-mono text-[9px]">
          <span style={{ color: pMeta.color }}>{pMeta.label.toUpperCase()}</span>
          <span className="flex items-center gap-1 text-steel">
            <span className="h-1 w-1 rounded-full" style={{ background: cMeta.color }} />
            {cMeta.label}
          </span>
          {task.due && <span className={overdue ? 'text-alert' : 'text-steel'}>{overdue ? '⚠ ' : ''}due {task.due}</span>}
          {task.scheduled && <span className="text-holo/70">on timeline</span>}
          {task.linkedNodeId && (
            <button
              onClick={() => {
                select(task.linkedNodeId!);
                setView('godseye');
              }}
              className="text-holo/70 hover:text-holo hover:underline"
            >
              ◉ node
            </button>
          )}
        </div>
      </div>
      {IS_TOUCH && !task.done && !task.scheduled && (
        <button
          aria-label="Schedule at next free hour"
          onClick={() => scheduleAtNextFreeSlot(task.id)}
          className="shrink-0 p-1 text-holo/70 hover:text-holo"
        >
          <CalendarClock className="h-4 w-4" />
        </button>
      )}
      <button
        aria-label="Delete task"
        onClick={() => deleteTask(task.id)}
        className={cn(
          'shrink-0 text-steel/50 transition-opacity hover:text-alert',
          IS_TOUCH ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
});
