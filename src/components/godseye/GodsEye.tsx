import { lazy, Suspense, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useBrainStore } from '@/stores/brain';
import { useUIStore } from '@/stores/ui';
import type { BrainNode, Category, NodeType } from '@/types';
import { buildLinks, suggestLinks } from '@/lib/graph';
import { CATEGORY_META } from '@/lib/utils';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { GraphHUD } from './GraphHUD';
import { NodeDetail } from './NodeDetail';

const GraphCanvas = lazy(() => import('./GraphCanvas').then((m) => ({ default: m.GraphCanvas })));

export function GodsEye({ startVoice, active = true }: { startVoice: () => void; active?: boolean }) {
  const nodes = useBrainStore((s) => s.nodes);
  const manualLinks = useBrainStore((s) => s.manualLinks);
  const [addOpen, setAddOpen] = useState(false);

  const links = useMemo(() => buildLinks(nodes, manualLinks), [nodes, manualLinks]);

  const handleVoiceOnNode = (node: BrainNode) => {
    useBrainStore.getState().select(node.id);
    useUIStore.getState().toast(`Voice armed on “${node.title}” — speak your command`, 'info');
    startVoice();
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <ErrorBoundary
        fallback={(reset) => (
          <div className="grid h-full place-items-center">
            <div className="glass max-w-sm border-alert/30 p-6 text-center">
              <p className="font-mono text-xs tracking-widest text-alert">NEURAL MAP FAULT CONTAINED</p>
              <p className="mt-2 text-xs leading-relaxed text-steel">
                The graph renderer hit an unexpected state. Your data is untouched.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => {
                    const s = useBrainStore.getState();
                    s.setViewMode(s.viewMode === '3d' ? '2d' : '3d');
                    reset();
                  }}
                  className="btn-ghost border border-white/10"
                >
                  Try {useBrainStore.getState().viewMode === '3d' ? '2D' : '3D'} mode
                </button>
                <button onClick={reset} className="btn-holo">
                  Reinitialize
                </button>
              </div>
            </div>
          </div>
        )}
      >
        <Suspense
          fallback={
            <div className="grid h-full place-items-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 animate-spin-slow rounded-full border border-holo/40 border-t-holo" />
                <p className="font-mono text-xs tracking-widest text-holo/70">MATERIALIZING NEURAL MAP…</p>
              </div>
            </div>
          }
        >
          <GraphCanvas nodes={nodes} links={links} paused={!active} />
        </Suspense>
      </ErrorBoundary>

      <GraphHUD onAddNode={() => setAddOpen(true)} />
      <NodeDetail links={links} onVoiceOnNode={handleVoiceOnNode} />
      <AddNodeModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

/* ---------------- Add node modal with live link suggestions ---------------- */

const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
const TYPES: NodeType[] = ['note', 'project', 'task', 'person', 'idea', 'event'];

function AddNodeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nodes = useBrainStore((s) => s.nodes);
  const addNode = useBrainStore((s) => s.addNode);
  const addManualLink = useBrainStore((s) => s.addManualLink);
  const select = useBrainStore((s) => s.select);
  const toast = useUIStore((s) => s.toast);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>('ideas');
  const [type, setType] = useState<NodeType>('note');
  const [chosenLinks, setChosenLinks] = useState<Set<string>>(new Set());

  const suggestions = useMemo(
    () => (title.trim().length > 2 ? suggestLinks(nodes, `${title} ${content}`, undefined, 6) : []),
    [nodes, title, content]
  );

  const submit = () => {
    if (!title.trim()) return;
    const node = addNode({ title: title.trim(), content: content || `# ${title.trim()}\n\n`, category, type, tags: [category] });
    chosenLinks.forEach((id) => addManualLink(node.id, id));
    toast(`Node “${node.title}” added to the brain`, 'success');
    select(node.id);
    setTitle('');
    setContent('');
    setChosenLinks(new Set());
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="glass w-full max-w-lg border-holo/20 p-5 shadow-holo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold tracking-wide text-holo">NEW BRAIN NODE</h3>
              <button aria-label="Close" onClick={onClose} className="btn-ghost !p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && submit()}
                placeholder="Title"
                className="w-full font-display"
                aria-label="Node title"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Markdown content — use [[wikilinks]] to connect ideas…"
                rows={5}
                className="w-full resize-none font-mono text-xs"
                aria-label="Node content"
              />
              <div className="flex gap-2">
                <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="flex-1 text-xs" aria-label="Category">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-abyss">
                      {CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
                <select value={type} onChange={(e) => setType(e.target.value as NodeType)} className="flex-1 text-xs" aria-label="Type">
                  {TYPES.map((t) => (
                    <option key={t} value={t} className="bg-abyss">
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {suggestions.length > 0 && (
                <div>
                  <span className="hud-label">Suggested connections</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {suggestions.map((n) => {
                      const on = chosenLinks.has(n.id);
                      return (
                        <button
                          key={n.id}
                          onClick={() =>
                            setChosenLinks((prev) => {
                              const next = new Set(prev);
                              if (on) next.delete(n.id);
                              else next.add(n.id);
                              return next;
                            })
                          }
                          className={`rounded-md border px-2 py-1 text-[11px] transition-all ${
                            on ? 'border-holo/60 bg-holo/15 text-holo' : 'border-dashed border-white/15 text-steel hover:text-ice'
                          }`}
                        >
                          {on ? '✓ ' : '+ '}
                          {n.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="btn-ghost">
                  Cancel
                </button>
                <button onClick={submit} disabled={!title.trim()} className="btn-holo disabled:opacity-40">
                  Add to brain
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
