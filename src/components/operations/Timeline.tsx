import { memo, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { addDays, format, isToday, parseISO } from 'date-fns';
import { Lock, X } from 'lucide-react';
import { useOpsStore } from '@/stores/ops';
import { useUIStore } from '@/stores/ui';
import { CATEGORY_META, clamp, minToLabel } from '@/lib/utils';

const START_MIN = 6 * 60;
const END_MIN = 23 * 60;
const PX_PER_MIN = 0.85;
const DAYS_SHOWN = 5;
const SNAP = 15;

const toY = (min: number) => (min - START_MIN) * PX_PER_MIN;
const fromY = (y: number) => Math.round((y / PX_PER_MIN + START_MIN) / SNAP) * SNAP;

/** Visual calendar: today + next 4 days. Drop tasks onto it; drag blocks to retime. */
export const Timeline = memo(function Timeline() {
  const events = useOpsStore((s) => s.events);
  const tasks = useOpsStore((s) => s.tasks);
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => format(addDays(new Date(), i), 'yyyy-MM-dd')), []);

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div className="glass glass-hover flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="hud-label text-holo">Timeline · next {DAYS_SHOWN} days</span>
        <span className="font-mono text-[10px] text-steel">drag tasks in · drag blocks to retime</span>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex min-w-[640px]">
          {/* Hour gutter */}
          <div className="sticky left-0 z-10 w-12 shrink-0 bg-abyss/80 backdrop-blur">
            <div className="h-9 border-b border-white/10" />
            <div className="relative" style={{ height: toY(END_MIN) }}>
              {Array.from({ length: (END_MIN - START_MIN) / 60 + 1 }, (_, i) => (
                <span
                  key={i}
                  className="absolute right-1.5 -translate-y-1/2 font-mono text-[9px] text-steel/70"
                  style={{ top: toY(START_MIN + i * 60) }}
                >
                  {minToLabel(START_MIN + i * 60)}
                </span>
              ))}
            </div>
          </div>
          {days.map((date) => (
            <DayColumn
              key={date}
              date={date}
              events={events.filter((e) => e.date === date)}
              scheduledTasks={tasks.filter((t) => t.scheduled?.date === date && !t.done)}
              nowMin={isToday(parseISO(date)) ? nowMin : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

function DayColumn({
  date,
  events,
  scheduledTasks,
  nowMin,
}: {
  date: string;
  events: ReturnType<typeof useOpsStore.getState>['events'];
  scheduledTasks: ReturnType<typeof useOpsStore.getState>['tasks'];
  nowMin: number | null;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const scheduleTask = useOpsStore((s) => s.scheduleTask);
  const toast = useUIStore((s) => s.toast);
  const d = parseISO(date);

  return (
    <div className="min-w-[120px] flex-1 border-l border-white/5">
      <div className={`flex h-9 items-center justify-center gap-1.5 border-b border-white/10 text-xs ${nowMin !== null ? 'text-holo' : 'text-steel'}`}>
        <span className="font-display font-semibold">{format(d, 'EEE')}</span>
        <span className="font-mono text-[10px]">{format(d, 'd MMM')}</span>
        {nowMin !== null && <span className="h-1.5 w-1.5 rounded-full bg-holo shadow-holo-sm" />}
      </div>
      <div
        ref={colRef}
        className="relative"
        style={{ height: toY(END_MIN) }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-jarvis-task')) e.preventDefault();
        }}
        onDrop={(e) => {
          const taskId = e.dataTransfer.getData('application/x-jarvis-task');
          if (!taskId || !colRef.current) return;
          e.preventDefault();
          const rect = colRef.current.getBoundingClientRect();
          const min = clamp(fromY(e.clientY - rect.top), START_MIN, END_MIN - 60);
          scheduleTask(taskId, date, min);
          toast(`Scheduled for ${format(d, 'EEE')} ${minToLabel(min)}`, 'success');
        }}
      >
        {/* Hour lines */}
        {Array.from({ length: (END_MIN - START_MIN) / 60 }, (_, i) => (
          <div key={i} className="absolute left-0 right-0 border-t border-white/[0.04]" style={{ top: toY(START_MIN + (i + 1) * 60) }} />
        ))}
        {/* Now line */}
        {nowMin !== null && nowMin >= START_MIN && nowMin <= END_MIN && (
          <div className="absolute left-0 right-0 z-10 border-t border-alert/80" style={{ top: toY(nowMin) }}>
            <span className="absolute -top-1 left-0 h-2 w-2 -translate-x-1/2 rounded-full bg-alert shadow-alert" />
          </div>
        )}
        {events.map((e) => (
          <EventBlock key={e.id} event={e} />
        ))}
        {scheduledTasks.map((t) => (
          <TaskBlock key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

function EventBlock({ event }: { event: ReturnType<typeof useOpsStore.getState>['events'][number] }) {
  const updateEvent = useOpsStore((s) => s.updateEvent);
  const deleteEvent = useOpsStore((s) => s.deleteEvent);
  const meta = CATEGORY_META[event.category];

  return (
    <motion.div
      drag="y"
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={(_, info) => {
        const next = clamp(
          Math.round((event.startMin + info.offset.y / PX_PER_MIN) / SNAP) * SNAP,
          START_MIN,
          END_MIN - event.durationMin
        );
        updateEvent(event.id, { startMin: next });
      }}
      className="group absolute left-1 right-1 z-[5] cursor-grab overflow-hidden rounded-md border px-2 py-1 backdrop-blur-sm active:cursor-grabbing"
      style={{
        top: toY(event.startMin),
        height: Math.max(22, event.durationMin * PX_PER_MIN - 2),
        background: meta.dim,
        borderColor: `${meta.color}55`,
        boxShadow: `inset 2px 0 0 ${meta.color}`,
      }}
      whileDrag={{ scale: 1.02, zIndex: 30, boxShadow: `0 0 18px -4px ${meta.color}` }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="truncate text-[11px] font-medium leading-tight" style={{ color: meta.color }}>
          {event.protected && <Lock className="mr-1 inline h-2.5 w-2.5" />}
          {event.title}
        </span>
        {!event.protected && (
          <button
            aria-label="Delete event"
            onClick={() => deleteEvent(event.id)}
            className="hidden shrink-0 text-steel hover:text-alert group-hover:block"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <span className="font-mono text-[9px] text-steel">
        {minToLabel(event.startMin)} · {event.durationMin}m
      </span>
    </motion.div>
  );
}

function TaskBlock({ task }: { task: ReturnType<typeof useOpsStore.getState>['tasks'][number] }) {
  const unscheduleTask = useOpsStore((s) => s.unscheduleTask);
  const scheduleTask = useOpsStore((s) => s.scheduleTask);
  const toggleTask = useOpsStore((s) => s.toggleTask);
  const meta = CATEGORY_META[task.category];
  const s = task.scheduled!;

  return (
    <motion.div
      drag="y"
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={(_, info) => {
        const next = clamp(Math.round((s.startMin + info.offset.y / PX_PER_MIN) / SNAP) * SNAP, START_MIN, END_MIN - s.durationMin);
        scheduleTask(task.id, s.date, next, s.durationMin);
      }}
      className="group absolute left-1 right-1 z-[6] cursor-grab overflow-hidden rounded-md border border-dashed px-2 py-1 backdrop-blur-sm active:cursor-grabbing"
      style={{
        top: toY(s.startMin),
        height: Math.max(22, s.durationMin * PX_PER_MIN - 2),
        background: 'rgba(5,7,15,0.55)',
        borderColor: `${meta.color}66`,
      }}
      whileDrag={{ scale: 1.02, zIndex: 30 }}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          onClick={() => toggleTask(task.id)}
          className="truncate text-left text-[11px] font-medium leading-tight text-ice/90 hover:text-holo"
          title="Mark done"
        >
          ☐ {task.title}
        </button>
        <button aria-label="Unschedule" onClick={() => unscheduleTask(task.id)} className="hidden shrink-0 text-steel hover:text-alert group-hover:block">
          <X className="h-3 w-3" />
        </button>
      </div>
      <span className="font-mono text-[9px]" style={{ color: meta.color }}>
        task · {minToLabel(s.startMin)}
      </span>
    </motion.div>
  );
}
