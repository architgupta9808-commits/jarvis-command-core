import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Crosshair, Link2, Mic, Pencil, Save, Trash2, X } from 'lucide-react';
import { useBrainStore } from '@/stores/brain';
import type { BrainLink, BrainNode } from '@/types';
import { neighborsOf, suggestLinks } from '@/lib/graph';
import { CATEGORY_META, cn } from '@/lib/utils';

/** Slide-in glass panel with full markdown, metadata, and quick actions. */
export const NodeDetail = memo(function NodeDetail({
  links,
  onVoiceOnNode,
}: {
  links: BrainLink[];
  onVoiceOnNode: (node: BrainNode) => void;
}) {
  const nodes = useBrainStore((s) => s.nodes);
  const selectedId = useBrainStore((s) => s.selectedId);
  const select = useBrainStore((s) => s.select);
  const updateNode = useBrainStore((s) => s.updateNode);
  const deleteNode = useBrainStore((s) => s.deleteNode);
  const addManualLink = useBrainStore((s) => s.addManualLink);
  const setFocusQuery = useBrainStore((s) => s.setFocusQuery);

  const node = nodes.find((n) => n.id === selectedId) ?? null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [linkPicker, setLinkPicker] = useState('');

  const neighborNodes = useMemo(() => {
    if (!node) return [];
    const ids = neighborsOf(node.id, links);
    return nodes.filter((n) => ids.has(n.id));
  }, [node, links, nodes]);

  const linkSuggestions = useMemo(() => {
    if (!node || !linkPicker.trim()) return [];
    const q = linkPicker.toLowerCase();
    const connected = new Set(neighborNodes.map((n) => n.id));
    return nodes
      .filter((n) => n.id !== node.id && !connected.has(n.id) && n.title.toLowerCase().includes(q))
      .slice(0, 5);
  }, [node, linkPicker, nodes, neighborNodes]);

  const smartSuggestions = useMemo(() => {
    if (!node) return [];
    const connected = new Set(neighborNodes.map((n) => n.id));
    return suggestLinks(nodes, `${node.title} ${node.content}`, node.id, 4).filter((n) => !connected.has(n.id));
  }, [node, nodes, neighborNodes]);

  const startEdit = () => {
    if (!node) return;
    setDraft(node.content);
    setEditing(true);
  };
  const saveEdit = () => {
    if (!node) return;
    updateNode(node.id, { content: draft });
    setEditing(false);
  };

  /** Rewrite [[wikilinks]] into md links with a node: scheme, rendered as clickable spans. */
  const wikiRendered = useMemo(() => {
    if (!node) return '';
    return node.content.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, target, alias) => {
      const hit = nodes.find((n) => n.title.toLowerCase() === String(target).trim().toLowerCase());
      const label = alias || target;
      return hit ? `[${label}](node:${hit.id})` : `[${label}](node:dead)`;
    });
  }, [node, nodes]);

  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          key={node.id}
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="absolute z-20 flex flex-col max-md:inset-x-2 max-md:bottom-2 max-md:max-h-[70vh] md:bottom-4 md:right-4 md:top-4 md:w-[380px]"
        >
          <div className="glass flex h-full flex-col overflow-hidden border-holo/20 shadow-holo">
            {/* Header */}
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                      style={{ color: CATEGORY_META[node.category].color, background: CATEGORY_META[node.category].dim }}
                    >
                      {node.type} · {CATEGORY_META[node.category].label}
                    </span>
                    {node.pinned && <span className="text-[10px] text-holo">★ pinned</span>}
                  </div>
                  <h2 className="font-display text-lg font-semibold leading-tight text-ice">{node.title}</h2>
                </div>
                <button aria-label="Close panel" onClick={() => select(null)} className="btn-ghost !p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Quick actions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {editing ? (
                  <button onClick={saveEdit} className="btn-holo !px-2 !py-1">
                    <Save className="h-3 w-3" /> Save
                  </button>
                ) : (
                  <button onClick={startEdit} className="btn-ghost !px-2 !py-1">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
                <button onClick={() => setFocusQuery(node.title)} className="btn-ghost !px-2 !py-1">
                  <Crosshair className="h-3 w-3" /> Focus subgraph
                </button>
                <button onClick={() => onVoiceOnNode(node)} className="btn-ghost !px-2 !py-1">
                  <Mic className="h-3 w-3" /> Voice
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete node “${node.title}”?`)) deleteNode(node.id);
                  }}
                  className="btn-ghost !px-2 !py-1 hover:!text-alert"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {editing ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-full min-h-[240px] w-full resize-none font-mono text-xs leading-relaxed"
                  aria-label="Edit markdown content"
                />
              ) : (
                <div className="md-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => {
                        if (href?.startsWith('node:')) {
                          const id = href.slice(5);
                          const dead = id === 'dead';
                          return (
                            <span
                              role="link"
                              tabIndex={0}
                              className={dead ? 'wikilink-dead' : 'wikilink'}
                              onClick={() => !dead && select(id)}
                              onKeyDown={(e) => e.key === 'Enter' && !dead && select(id)}
                            >
                              {children}
                            </span>
                          );
                        }
                        return (
                          <a href={href} target="_blank" rel="noreferrer">
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {wikiRendered}
                  </ReactMarkdown>
                </div>
              )}

              {/* Connections */}
              {!editing && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <span className="hud-label">Connections ({neighborNodes.length})</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {neighborNodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => select(n.id)}
                        className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-ice/80 transition-all hover:border-holo/40 hover:text-holo"
                      >
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_META[n.category].color }} />
                        {n.title}
                      </button>
                    ))}
                    {neighborNodes.length === 0 && <span className="text-[11px] text-steel">Isolated node — link it below.</span>}
                  </div>

                  {/* Add link */}
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-holo/70" />
                      <input
                        value={linkPicker}
                        onChange={(e) => setLinkPicker(e.target.value)}
                        placeholder="Link to node…"
                        className="flex-1 !py-1 text-xs"
                        aria-label="Search node to link"
                      />
                    </div>
                    {linkSuggestions.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {linkSuggestions.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              addManualLink(node.id, n.id);
                              setLinkPicker('');
                            }}
                            className="block w-full rounded-md border border-white/10 px-2 py-1 text-left text-[11px] text-steel hover:border-holo/40 hover:text-ice"
                          >
                            + {n.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {smartSuggestions.length > 0 && !linkPicker && (
                      <div className="mt-2">
                        <span className="text-[10px] text-steel/80">JARVIS suggests:</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {smartSuggestions.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => addManualLink(node.id, n.id)}
                              className="rounded-md border border-dashed border-holo/30 px-2 py-0.5 text-[10px] text-holo/80 hover:bg-holo/10"
                            >
                              + {n.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Meta footer */}
            <div className="border-t border-white/10 px-4 py-2 font-mono text-[10px] text-steel">
              <span>created {format(parseISO(node.createdAt), 'd MMM yy')}</span>
              <span className="mx-2 text-white/20">|</span>
              <span>updated {format(parseISO(node.updatedAt), 'd MMM yy')}</span>
              {node.tags.length > 0 && (
                <>
                  <span className="mx-2 text-white/20">|</span>
                  <span className="text-holo/70">{node.tags.map((t) => `#${t}`).join(' ')}</span>
                </>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
});
