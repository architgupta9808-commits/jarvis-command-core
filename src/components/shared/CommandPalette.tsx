import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Command, Eye, LayoutDashboard, Mic, Plus, Search, Settings } from 'lucide-react';
import { useBrainStore } from '@/stores/brain';
import { useUIStore } from '@/stores/ui';
import { useOpsStore } from '@/stores/ops';
import { CATEGORY_META, fuzzyMatch } from '@/lib/utils';

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

/** ⌘K / Ctrl+K command palette: commands + instant node search. */
export function CommandPalette({ startVoice }: { startVoice: () => void }) {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPalette);
  const nodes = useBrainStore((s) => s.nodes);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUIStore.getState().commandPaletteOpen);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      { id: 'voice', label: 'Voice command', hint: 'hold Space', icon: <Mic className="h-3.5 w-3.5" />, run: () => { setOpen(false); startVoice(); } },
      { id: 'godseye', label: "Switch to God's Eye", hint: '1', icon: <Eye className="h-3.5 w-3.5" />, run: () => { useUIStore.getState().setView('godseye'); setOpen(false); } },
      { id: 'ops', label: 'Switch to Operations', hint: '2', icon: <LayoutDashboard className="h-3.5 w-3.5" />, run: () => { useUIStore.getState().setView('operations'); setOpen(false); } },
      { id: 'notes', label: 'Switch to Notes', hint: '3', icon: <Plus className="h-3.5 w-3.5" />, run: () => { useUIStore.getState().setView('notes'); setOpen(false); } },
      {
        id: 'newtask', label: 'New task', icon: <Plus className="h-3.5 w-3.5" />,
        run: () => {
          setOpen(false);
          const title = prompt('Task title:');
          if (title?.trim()) useOpsStore.getState().addTask({ title: title.trim() });
        },
      },
      { id: 'settings', label: 'Open settings', icon: <Settings className="h-3.5 w-3.5" />, run: () => { setOpen(false); useUIStore.getState().setSettingsOpen(true); } },
    ],
    [setOpen, startVoice]
  );

  const results = useMemo(() => {
    const q = query.trim();
    const cmdHits = commands.filter((c) => !q || fuzzyMatch(c.label, q));
    const nodeHits = q
      ? nodes.filter((n) => fuzzyMatch(`${n.title} ${n.tags.join(' ')}`, q)).slice(0, 8)
      : nodes.filter((n) => n.pinned).slice(0, 5);
    return { cmdHits, nodeHits, total: cmdHits.length + nodeHits.length };
  }, [query, commands, nodes]);

  const activate = (index: number) => {
    if (index < results.cmdHits.length) {
      results.cmdHits[index].run();
    } else {
      const node = results.nodeHits[index - results.cmdHits.length];
      if (node) {
        useBrainStore.getState().select(node.id);
        useUIStore.getState().setView('godseye');
        setOpen(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-void/70 p-4 pt-[14vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.97, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="glass w-full max-w-xl overflow-hidden border-holo/20 shadow-holo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
              <Search className="h-4 w-4 text-holo/70" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.total - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                  if (e.key === 'Enter') { e.preventDefault(); activate(cursor); }
                }}
                placeholder="Type a command or search the brain…"
                className="flex-1 !border-0 !bg-transparent !p-0 text-sm"
                aria-label="Command palette input"
              />
              <span className="flex items-center gap-1 font-mono text-[9px] text-steel"><Command className="h-3 w-3" />K</span>
            </div>
            <div className="max-h-[46vh] overflow-y-auto p-2">
              {results.cmdHits.length > 0 && (
                <>
                  <span className="hud-label block px-2 py-1">Commands</span>
                  {results.cmdHits.map((c, i) => (
                    <PaletteRow key={c.id} active={cursor === i} onClick={() => activate(i)} onHover={() => setCursor(i)}>
                      <span className="text-holo/80">{c.icon}</span>
                      <span className="flex-1 text-sm text-ice">{c.label}</span>
                      {c.hint && <span className="font-mono text-[9px] text-steel">{c.hint}</span>}
                    </PaletteRow>
                  ))}
                </>
              )}
              {results.nodeHits.length > 0 && (
                <>
                  <span className="hud-label block px-2 py-1 pt-2">{query ? 'Brain nodes' : 'Pinned'}</span>
                  {results.nodeHits.map((n, j) => {
                    const i = results.cmdHits.length + j;
                    return (
                      <PaletteRow key={n.id} active={cursor === i} onClick={() => activate(i)} onHover={() => setCursor(i)}>
                        <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_META[n.category].color }} />
                        <span className="flex-1 truncate text-sm text-ice">{n.title}</span>
                        <span className="font-mono text-[9px] uppercase text-steel">{n.type}</span>
                      </PaletteRow>
                    );
                  })}
                </>
              )}
              {results.total === 0 && <p className="px-3 py-6 text-center text-xs text-steel">Nothing matches “{query}”.</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PaletteRow({ children, active, onClick, onHover }: { children: React.ReactNode; active: boolean; onClick: () => void; onHover: () => void }) {
  return (
    <button
      onClick={onClick}
      onMouseMove={onHover}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
        active ? 'border border-holo/30 bg-holo/10' : 'border border-transparent hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}
