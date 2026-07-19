import { memo } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AlertTriangle, CreditCard, Mail } from 'lucide-react';
import { useLiveStore } from '@/stores/live';

const CATEGORY_COLORS: Record<string, string> = {
  'Titan / Corporate': '#E5484D',
  Banking: '#E2A85C',
  Vendors: '#E6C37C',
  Subscriptions: '#B49AE8',
  Promotions: '#9A8F78',
  Personal: '#7FC9A2',
  Other: '#C8D8E8',
};

/** Daily Gmail digest published by the PC data engine into the sync gist. */
export const GmailPanel = memo(function GmailPanel() {
  const digest = useLiveStore((s) => s.gmailDigest);

  return (
    <div className="glass glass-hover flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <Mail className="h-3.5 w-3.5 text-holo" />
        <span className="hud-label text-holo">Gmail Intelligence</span>
        {digest && (
          <span className="ml-auto font-mono text-[9px] text-faint">
            {formatDistanceToNow(parseISO(digest.generatedAt), { addSuffix: true })}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!digest ? (
          <div className="py-10 text-center">
            <Mail className="mx-auto mb-3 h-6 w-6 text-steel/50" />
            <p className="text-xs leading-relaxed text-steel">
              Awaiting the first mail digest.
              <br />
              The PC engine publishes one daily — it will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Today */}
            <div>
              <p className="hud-label mb-2">Today</p>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl text-ice">{digest.today.total}</span>
                <span className="text-[11px] text-steel">mails</span>
                {digest.today.urgent.length > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-alert">
                    <AlertTriangle className="h-3 w-3" /> {digest.today.urgent.length} urgent
                  </span>
                )}
              </div>
              {digest.today.urgent.slice(0, 4).map((u, i) => (
                <div key={i} className="mt-2 rounded-lg border border-alert/25 bg-alert/[0.06] px-3 py-2">
                  <p className="truncate text-xs font-medium text-ice">{u.subject}</p>
                  <p className="truncate font-mono text-[10px] text-alert/90">{u.from}</p>
                </div>
              ))}
            </div>

            {/* Week breakdown */}
            <div>
              <p className="hud-label mb-2">
                Last 7 days · {digest.week.total} mails · {digest.week.urgentCount} urgent
              </p>
              <div className="space-y-1.5">
                {Object.entries(digest.week.categories)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => {
                    const max = Math.max(...Object.values(digest.week.categories), 1);
                    const color = CATEGORY_COLORS[cat] ?? '#C8D8E8';
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-[11px] text-steel">{cat}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/[0.05]">
                          <div
                            className="h-full rounded"
                            style={{ width: `${(count / max) * 100}%`, background: color }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right font-mono text-[10px] text-ice">{count}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Subscriptions */}
            <div>
              <p className="hud-label mb-2 flex items-center gap-1.5">
                <CreditCard className="h-3 w-3" /> Active paid subscriptions · {digest.subscriptions.active.length}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {digest.subscriptions.active.map((s) => (
                  <span
                    key={s.name}
                    title={s.note}
                    className="rounded-md border border-[#B49AE8]/30 bg-[#B49AE8]/[0.08] px-2 py-1 text-[11px] text-ice"
                  >
                    {s.name}
                  </span>
                ))}
                {digest.subscriptions.active.length === 0 && (
                  <span className="text-[11px] text-steel">None detected in recent receipts.</span>
                )}
              </div>
              <p className="mt-2 font-mono text-[10px] text-faint">
                {digest.subscriptions.mailCount7d} subscription mails this week
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
