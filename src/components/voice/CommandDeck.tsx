import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useUIStore } from '@/stores/ui';
import { describeAction } from '@/lib/actions';
import { confirmDeck } from './pipeline';

/** Glass panel showing transcription → analysis → proposed actions diff → confirm. */
export function CommandDeck() {
  const { deckStatus, transcript, interim, analysis, excludedActions, deckError, toggleAction, resetDeck } =
    useUIStore();

  const visible = deckStatus !== 'idle';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 z-40 w-[min(560px,calc(100vw-3rem))] -translate-x-1/2"
        >
          <div className="glass overflow-hidden border-holo/20 shadow-holo">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
              <span className="hud-label text-holo">Command Deck</span>
              <div className="flex items-center gap-2">
                <StatusChip status={deckStatus} />
                <button aria-label="Dismiss" onClick={resetDeck} className="btn-ghost !p-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
              {/* Transcript */}
              {(transcript || interim || deckStatus === 'listening') && (
                <p className="font-display text-sm leading-relaxed">
                  {transcript && <span className="text-ice">{transcript} </span>}
                  {interim && <span className="text-steel italic">{interim}</span>}
                  {deckStatus === 'listening' && <Cursor />}
                  {!transcript && !interim && deckStatus === 'listening' && (
                    <span className="text-steel">Listening…</span>
                  )}
                </p>
              )}

              {/* Analyzing animation */}
              {deckStatus === 'analyzing' && (
                <div className="mt-3 flex items-center gap-3 text-holo">
                  <NeuralPulse />
                  <span className="font-mono text-xs tracking-widest">JARVIS ANALYZING…</span>
                </div>
              )}

              {/* Preview */}
              {deckStatus === 'preview' && analysis && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm italic text-holo/90">“{analysis.reply}”</p>
                  {deckError && <p className="text-[11px] text-alert">{deckError}</p>}
                  {analysis.actions.length > 0 ? (
                    <ul className="space-y-1.5">
                      {analysis.actions.map((a, i) => {
                        const d = describeAction(a);
                        const excluded = excludedActions.has(i);
                        return (
                          <li key={i}>
                            <button
                              onClick={() => toggleAction(i)}
                              className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                                excluded
                                  ? 'border-white/5 bg-white/[0.02] text-steel/50 line-through'
                                  : 'border-holo/20 bg-holo/5 text-ice hover:border-holo/40'
                              }`}
                            >
                              <span className={excluded ? 'text-steel/50' : 'text-holo'}>{d.icon}</span>
                              <span className="flex-1">{d.text}</span>
                              <span
                                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
                                  excluded ? 'border-white/15' : 'border-holo/60 bg-holo/15'
                                }`}
                              >
                                {!excluded && <Check className="h-3 w-3 text-holo" />}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-steel">No actionable changes proposed.</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {deckStatus === 'preview' && analysis && (
              <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-2.5">
                <button onClick={resetDeck} className="btn-ghost">
                  Discard
                </button>
                <button onClick={confirmDeck} className="btn-holo" autoFocus>
                  <Check className="h-3.5 w-3.5" /> Execute {analysis.actions.length - excludedActions.size} action
                  {analysis.actions.length - excludedActions.size === 1 ? '' : 's'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    listening: { label: 'LIVE', cls: 'text-alert border-alert/40 bg-alert/10' },
    analyzing: { label: 'ANALYZING', cls: 'text-holo border-holo/40 bg-holo/10' },
    preview: { label: 'AWAITING CONFIRM', cls: 'text-holo border-holo/40 bg-holo/10' },
    executing: { label: 'EXECUTING', cls: 'text-holo border-holo/40 bg-holo/10' },
  };
  const m = map[status];
  if (!m) return null;
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-widest ${m.cls}`}>{m.label}</span>;
}

function Cursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
      className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-holo"
    />
  );
}

function NeuralPulse() {
  return (
    <span className="relative flex h-6 w-6 items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border border-holo/60"
          animate={{ scale: [0.4, 1.15], opacity: [0.9, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.45, ease: 'easeOut' }}
        />
      ))}
      <span className="h-1.5 w-1.5 rounded-full bg-holo" />
    </span>
  );
}
