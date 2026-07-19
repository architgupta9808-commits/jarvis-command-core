import { format } from 'date-fns';
import { BrainCircuit, CalendarPlus, ListPlus, Wand2 } from 'lucide-react';
import { useOpsStore } from '@/stores/ops';
import { useBrainStore } from '@/stores/brain';
import { useUIStore } from '@/stores/ui';
import { executeActions } from '@/lib/actions';
import { Briefing } from './Briefing';
import { Timeline } from './Timeline';
import { TaskList } from './TaskList';
import { Feed } from './Feed';

export function Operations() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 lg:overflow-hidden">
      <Briefing />
      <QuickActions />
      <div className="grid min-h-[480px] flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-[1fr_320px_300px]">
        <div className="min-h-[420px] lg:min-h-0"><Timeline /></div>
        <div className="min-h-[360px] lg:min-h-0"><TaskList /></div>
        <div className="min-h-[360px] lg:min-h-0"><Feed /></div>
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
    // Runs through the same action engine the voice pipeline uses.
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
