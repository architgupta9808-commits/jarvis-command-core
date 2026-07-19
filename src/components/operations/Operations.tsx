import { useState } from 'react';
import { format } from 'date-fns';
import {
  BrainCircuit, CalendarDays, CalendarPlus, ListChecks, ListPlus, Mail, Radar, Sparkles, Wand2,
} from 'lucide-react';
import { useOpsStore } from '@/stores/ops';
import { useBrainStore } from '@/stores/brain';
import { useUIStore } from '@/stores/ui';
import { executeActions } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { Briefing } from './Briefing';
import { Timeline } from './Timeline';
import { TaskList } from './TaskList';
import { Feed } from './Feed';
import { GmailPanel } from './GmailPanel';

type OpsTab = 'brief' | 'timeline' | 'queue' | 'feed' | 'gmail';

const TABS: { id: OpsTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'brief', label: 'Brief', icon: Sparkles },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  { id: 'queue', label: 'Queue', icon: ListChecks },
  { id: 'feed', label: 'Feed', icon: Radar },
  { id: 'gmail', label: 'Gmail', icon: Mail },
];

export function Operations() {
  const [tab, setTab] = useState<OpsTab>('brief');

  return (
    <div className="flex h-full flex-col">
      {/* ---- Phone (portrait): one panel at a time behind icon tabs ---- */}
      <div className="flex h-full flex-col gap-3 p-3 lg:hidden">
        <nav className="glass flex shrink-0 items-center justify-around !rounded-xl p-1" aria-label="Operations sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                'flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors',
                tab === t.id ? 'bg-holo/10 text-holo' : 'text-steel'
              )}
            >
              <t.icon className="h-[18px] w-[18px]" />
              <span className="font-mono text-[8.5px] uppercase tracking-wider">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'brief' && (
            <div className="space-y-3">
              <Briefing />
              <QuickActions />
            </div>
          )}
          {tab === 'timeline' && <div className="h-full"><Timeline /></div>}
          {tab === 'queue' && <div className="h-full"><TaskList /></div>}
          {tab === 'feed' && <div className="h-full"><Feed /></div>}
          {tab === 'gmail' && <div className="h-full"><GmailPanel /></div>}
        </div>
      </div>

      {/* ---- Desktop: the full command-center grid ---- */}
      <div className="hidden h-full flex-col gap-4 p-4 lg:flex">
        <Briefing />
        <QuickActions />
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px_320px] gap-4">
          <Timeline />
          <TaskList />
          <div className="flex min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1"><GmailPanel /></div>
            <div className="min-h-0 flex-1"><Feed /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const addTask = useOpsStore((s) => s.addTask);
  const toast = useUIStore((s) => s.toast);

  const quickTask = () => {
    const title = prompt('Task title:');
    if (title?.trim()) {
      addTask({ title: title.trim() });
      toast('Task added to the mission queue', 'success');
    }
  };

  const quickReminder = () => {
    const title = prompt('Remind you about:');
    if (title?.trim()) {
      addTask({ title: title.trim(), priority: 'high', due: format(new Date(), 'yyyy-MM-dd') });
      useOpsStore.getState().pushFeed({ kind: 'reminder', title: 'Reminder set', body: title.trim(), priority: 1 });
      toast('Reminder armed', 'success');
    }
  };

  const replanWithAI = () => {
    executeActions([
      {
        type: 'plan_day',
        date: format(new Date(), 'yyyy-MM-dd'),
        blocks: [
          { title: 'Deep work — top priority', startMin: 9 * 60, durationMin: 90, category: 'business' },
          { title: 'Ops + showroom rounds', startMin: 11 * 60, durationMin: 90, category: 'business' },
          { title: 'Music production block', startMin: 14 * 60, durationMin: 120, category: 'music', protected: true },
          { title: 'Admin batch + correspondence', startMin: 17 * 60, durationMin: 45, category: 'personal' },
        ],
      },
    ]);
    toast('Day replanned — protected blocks untouched', 'success');
  };

  const syncFromBrain = () => {
    const nodes = useBrainStore.getState().nodes;
    const tasks = useOpsStore.getState().tasks;
    const existing = new Set(tasks.map((t) => t.linkedNodeId).filter(Boolean));
    let created = 0;
    for (const n of nodes) {
      if (n.type === 'task' && !existing.has(n.id)) {
        useOpsStore.getState().addTask({ title: n.title, category: n.category, linkedNodeId: n.id, priority: n.importance >= 2 ? 'high' : 'normal' });
        created++;
      }
    }
    toast(created ? `${created} task node${created > 1 ? 's' : ''} pulled from God's Eye` : "Already in sync with God's Eye", created ? 'success' : 'info');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={quickTask} className="btn-holo"><ListPlus className="h-3.5 w-3.5" /> Add task</button>
      <button onClick={quickReminder} className="btn-holo"><CalendarPlus className="h-3.5 w-3.5" /> Add reminder</button>
      <button onClick={replanWithAI} className="btn-holo"><Wand2 className="h-3.5 w-3.5" /> Replan my day</button>
      <button onClick={syncFromBrain} className="btn-holo"><BrainCircuit className="h-3.5 w-3.5" /> Sync from God's Eye</button>
      <span className="ml-auto hidden font-mono text-[10px] text-steel md:block">tip: hold SPACE and just say it</span>
    </div>
  );
}
