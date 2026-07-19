import { memo, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, Lightbulb, Radar, X, Zap } from 'lucide-react';
import { useOpsStore } from '@/stores/ops';
import { useBrainStore } from '@/stores/brain';
import { useSettingsStore } from '@/stores/settings';
import { useUIStore } from '@/stores/ui';
import { deriveFeed } from '@/lib/briefing';
import type { FeedItem, FeedKind } from '@/types';

const KIND_META: Record<FeedKind, { icon: typeof Bell; color: string; label: string }> = {
  reminder: { icon: Bell, color: '#E2A85C', label: 'Reminder' },
  conflict: { icon: AlertTriangle, color: '#E5484D', label: 'Conflict' },
  opportunity: { icon: Zap, color: '#E6C37C', label: 'Opportunity' },
  insight: { icon: Lightbulb, color: '#B49AE8', label: 'Insight' },
  alert: { icon: AlertTriangle, color: '#E5484D', label: 'Alert' },
};

/** AI-curated Intelligence Feed: derived signals + voice-pushed notifications. */
export const Feed = memo(function Feed() {
  const feed = useOpsStore((s) => s.feed);
  const dismissFeed = useOpsStore((s) => s.dismissFeed);
  const tasks = useOpsStore((s) => s.tasks);
  const events = useOpsStore((s) => s.events);
  const nodes = useBrainStore((s) => s.nodes);
  const userName = useSettingsStore((s) => s.userName);

  const derived = useMemo(
    () => deriveFeed({ tasks, events, nodes, userName }),
    [tasks, events, nodes, userName]
  );

  const items = useMemo(() => {
    const manual = feed.filter((f) => !f.dismissed);
    // Manual (voice/AI-pushed) items first at equal priority, then derived signals.
    return [...manual, ...derived].sort((a, b) => a.priority - b.priority).slice(0, 14);
  }, [feed, derived]);

  return (
    <div className="glass glass-hover flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <Radar className="h-3.5 w-3.5 text-holo" />
        <span className="hud-label text-holo">Intelligence Feed</span>
        <span className="ml-auto font-mono text-[10px] text-steel">{items.length} signals</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <FeedCard key={item.id} item={item} onDismiss={feed.some((f) => f.id === item.id) ? () => dismissFeed(item.id) : undefined} />
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-steel">All quiet on every front, {userName}.</p>
        )}
      </div>
    </div>
  );
});

const FeedCard = memo(function FeedCard({ item, onDismiss }: { item: FeedItem; onDismiss?: () => void }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const select = useBrainStore((s) => s.select);
  const setView = useUIStore((s) => s.setView);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, transition: { duration: 0.15 } }}
      className="group relative rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-white/20"
      style={{ boxShadow: `inset 2px 0 0 ${meta.color}` }}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: meta.color }}>
              {meta.label}
            </span>
            {item.priority === 0 && <span className="font-mono text-[9px] text-alert">● P0</span>}
          </div>
          <p className="mt-0.5 text-xs font-medium text-ice">{item.title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-steel">{item.body}</p>
          {item.linkedNodeId && (
            <button
              onClick={() => {
                select(item.linkedNodeId!);
                setView('godseye');
              }}
              className="mt-1 font-mono text-[10px] text-holo/80 hover:text-holo hover:underline"
            >
              ◉ open in God's Eye
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            aria-label="Dismiss"
            onClick={onDismiss}
            className="shrink-0 text-steel/50 opacity-0 transition-opacity hover:text-ice group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
});
