import { format } from 'date-fns';
import { analyzeCommand } from '@/lib/ai';
import { executeActions } from '@/lib/actions';
import { useBrainStore } from '@/stores/brain';
import { useOpsStore } from '@/stores/ops';
import { useSettingsStore } from '@/stores/settings';
import { useUIStore } from '@/stores/ui';

/** transcript → LLM analysis → preview (confirmation happens in the Command Deck UI). */
export async function runVoicePipeline(transcript: string): Promise<void> {
  const ui = useUIStore.getState();
  ui.setDeck({ deckStatus: 'analyzing', transcript, interim: '', deckError: null });

  const nodes = useBrainStore.getState().nodes;
  const { tasks, events } = useOpsStore.getState();
  const today = format(new Date(), 'yyyy-MM-dd');

  try {
    const analysis = await analyzeCommand(transcript, {
      nodeTitles: nodes.map((n) => n.title),
      pendingTasks: tasks.filter((t) => !t.done).map((t) => ({ title: t.title, priority: t.priority, due: t.due })),
      todayEvents: events
        .filter((e) => e.date === today)
        .map((e) => ({ title: e.title, startMin: e.startMin, durationMin: e.durationMin, protected: e.protected })),
      userName: useSettingsStore.getState().userName,
    });
    useUIStore.getState().setDeck({ deckStatus: 'preview', analysis });
  } catch (err) {
    useUIStore.getState().setDeck({
      deckStatus: 'preview',
      analysis: { reply: 'I hit a snag analyzing that, Sir.', actions: [] },
      deckError: err instanceof Error ? err.message : 'Unknown analysis error',
    });
  }
}

/** Execute the actions the user left checked in the preview. */
export function confirmDeck(): void {
  const { analysis, excludedActions } = useUIStore.getState();
  if (!analysis) return;
  useUIStore.getState().setDeck({ deckStatus: 'executing' });
  const chosen = analysis.actions.filter((_, i) => !excludedActions.has(i));
  const summary = executeActions(chosen);
  useUIStore.getState().toast(chosen.length ? `⬡ ${summary}` : 'Nothing to execute', chosen.length ? 'success' : 'info');
  useUIStore.getState().resetDeck();
}
