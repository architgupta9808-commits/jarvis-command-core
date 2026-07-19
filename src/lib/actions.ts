import type { AIAction } from '@/types';
import { useBrainStore } from '@/stores/brain';
import { useOpsStore } from '@/stores/ops';
import { useUIStore } from '@/stores/ui';
import { bestMatch } from './graph';
import { minToLabel } from './utils';

/** Human-readable one-liner for the confirmation preview. */
export function describeAction(a: AIAction): { icon: string; text: string } {
  switch (a.type) {
    case 'create_node':
      return { icon: '◉', text: `New brain node “${a.title}”${a.linkTo?.length ? ` → linked to ${a.linkTo.join(', ')}` : ''}` };
    case 'update_node':
      return { icon: '◈', text: `Update node matching “${a.query}”` };
    case 'create_task':
      return { icon: '☐', text: `Task “${a.title}”${a.due ? ` (due ${a.due})` : ''}${a.priority ? ` [${a.priority}]` : ''}` };
    case 'complete_task':
      return { icon: '☑', text: `Complete task matching “${a.query}”` };
    case 'create_event':
      return { icon: '▣', text: `Event “${a.title}” on ${a.date} at ${minToLabel(a.startMin)} (${a.durationMin}m)` };
    case 'focus_graph':
      return { icon: '◎', text: `Focus God's Eye on “${a.query}”` };
    case 'switch_view':
      return { icon: '⇄', text: `Switch to ${a.view === 'godseye' ? "God's Eye" : 'Operations'}` };
    case 'plan_day':
      return { icon: '≡', text: `Plan ${a.date}: ${a.blocks.length} blocks (${a.blocks.map((b) => b.title).join(' · ')})` };
    case 'notify':
      return { icon: '◍', text: `${a.kind}: ${a.title}` };
    case 'clear_operations':
      return {
        icon: '⌫',
        text: `DELETE ${a.scope === 'all' ? 'ALL tasks and calendar events' : `all ${a.scope}`} — cannot be undone`,
      };
  }
}

/** Execute confirmed actions against the stores. Returns a summary for the toast. */
export function executeActions(actions: AIAction[]): string {
  const brain = useBrainStore.getState();
  const ops = useOpsStore.getState();
  const ui = useUIStore.getState();
  let done = 0;

  for (const a of actions) {
    switch (a.type) {
      case 'create_node': {
        const node = brain.addNode({
          title: a.title,
          content: a.content ?? `# ${a.title}\n`,
          category: a.category,
          type: a.nodeType,
          tags: a.tags,
        });
        for (const target of a.linkTo ?? []) {
          const hit = bestMatch(useBrainStore.getState().nodes, target);
          if (hit) brain.addManualLink(node.id, hit.id);
        }
        done++;
        break;
      }
      case 'update_node': {
        const hit = bestMatch(brain.nodes, a.query);
        if (hit) {
          const patch: Partial<typeof hit> = {};
          if (a.appendContent) patch.content = `${hit.content.trimEnd()}\n\n${a.appendContent}`;
          if (a.addTags?.length) patch.tags = [...new Set([...hit.tags, ...a.addTags])];
          brain.updateNode(hit.id, patch);
          for (const target of a.linkTo ?? []) {
            const t = bestMatch(brain.nodes, target);
            if (t) brain.addManualLink(hit.id, t.id);
          }
          done++;
        }
        break;
      }
      case 'create_task': {
        const linked = a.linkTo ? bestMatch(brain.nodes, a.linkTo) : undefined;
        ops.addTask({ title: a.title, priority: a.priority, category: a.category, due: a.due, linkedNodeId: linked?.id });
        done++;
        break;
      }
      case 'complete_task': {
        const t = ops.tasks.find((x) => !x.done && x.title.toLowerCase().includes(a.query.toLowerCase()));
        if (t) {
          ops.toggleTask(t.id);
          done++;
        }
        break;
      }
      case 'create_event': {
        ops.addEvent({ title: a.title, date: a.date, startMin: a.startMin, durationMin: a.durationMin, category: a.category, protected: a.protected });
        done++;
        break;
      }
      case 'focus_graph': {
        brain.setFocusQuery(a.query);
        brain.setSearch('');
        ui.setView('godseye');
        done++;
        break;
      }
      case 'switch_view': {
        ui.setView(a.view);
        done++;
        break;
      }
      case 'plan_day': {
        ops.replaceDayPlan(
          a.date,
          a.blocks.map((b) => ({
            title: b.title,
            date: a.date,
            startMin: b.startMin,
            durationMin: b.durationMin,
            category: b.category ?? 'personal',
            protected: b.protected,
          }))
        );
        done++;
        break;
      }
      case 'notify': {
        ops.pushFeed({ kind: a.kind, title: a.title, body: a.body, priority: a.priority ?? 1 });
        done++;
        break;
      }
      case 'clear_operations': {
        ops.clearOps(a.scope);
        ops.pushFeed({
          kind: 'alert',
          title: 'Operations cleared',
          body: `Removed ${a.scope === 'all' ? 'all tasks and events' : `all ${a.scope}`} on your instruction.`,
          priority: 1,
        });
        done++;
        break;
      }
    }
  }
  return `${done} change${done === 1 ? '' : 's'} synced to central core`;
}
