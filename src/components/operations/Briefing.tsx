import { memo, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RefreshCw } from 'lucide-react';
import { useOpsStore } from '@/stores/ops';
import { useBrainStore } from '@/stores/brain';
import { useSettingsStore } from '@/stores/settings';
import { generateBriefing, localBriefing } from '@/lib/briefing';

/** Personalized greeting + refreshable AI daily briefing. */
export const Briefing = memo(function Briefing() {
  const briefing = useOpsStore((s) => s.briefing);
  const setBriefing = useOpsStore((s) => s.setBriefing);
  const [loading, setLoading] = useState(false);

  const refresh = async (useAI: boolean) => {
    const input = {
      tasks: useOpsStore.getState().tasks,
      events: useOpsStore.getState().events,
      nodes: useBrainStore.getState().nodes,
      userName: useSettingsStore.getState().userName,
    };
    if (!useAI) {
      setBriefing(localBriefing(input));
      return;
    }
    setLoading(true);
    try {
      setBriefing(await generateBriefing(input));
    } finally {
      setLoading(false);
    }
  };

  // Generate a fresh local briefing when stale (older than 30 min) or missing.
  useEffect(() => {
    const stale = !briefing || Date.now() - parseISO(briefing.generatedAt).getTime() > 30 * 60 * 1000;
    if (stale) void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass glass-hover relative overflow-hidden p-5">
      {/* Corner brackets, very JARVIS */}
      <span className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t border-holo/50" />
      <span className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t border-holo/50" />
      <span className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l border-holo/50" />
      <span className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r border-holo/50" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-ice">{briefing?.greeting ?? 'Initializing…'}</h1>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-steel">
            Daily briefing · {format(new Date(), 'EEEE d MMMM')} ·{' '}
            <span className={briefing?.source === 'ai' ? 'text-holo' : ''}>{briefing?.source === 'ai' ? 'cloud intelligence' : 'local core'}</span>
          </p>
        </div>
        <button onClick={() => refresh(true)} disabled={loading} className="btn-holo shrink-0" aria-label="Refresh briefing">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Synthesizing…' : 'Refresh'}
        </button>
      </div>
      <div className="md-body mt-3 max-w-3xl">
        {briefing ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing.body}</ReactMarkdown>
        ) : (
          <p className="text-steel">Compiling situational awareness…</p>
        )}
      </div>
    </div>
  );
});
