import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Crosshair, Grid2x2, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { FOCUS_PRESETS, useBrainStore } from '@/stores/brain';
import type { Category, NodeType } from '@/types';
import { CATEGORY_META, cn } from '@/lib/utils';

const NODE_TYPES: NodeType[] = ['note', 'project', 'task', 'person', 'idea', 'event'];

export const GraphHUD = memo(function GraphHUD({ onAddNode }: { onAddNode: () => void }) {
  const searchQuery = useBrainStore((s) => s.searchQuery);
  const setSearch = useBrainStore((s) => s.setSearch);
  const activeCategories = useBrainStore((s) => s.activeCategories);
  const toggleCategory = useBrainStore((s) => s.toggleCategory);
  const activeTypes = useBrainStore((s) => s.activeTypes);
  const toggleType = useBrainStore((s) => s.toggleType);
  const focusQuery = useBrainStore((s) => s.focusQuery);
  const setFocusQuery = useBrainStore((s) => s.setFocusQuery);
  const viewMode = useBrainStore((s) => s.viewMode);
  const setViewMode = useBrainStore((s) => s.setViewMode);
  const nodeCount = useBrainStore((s) => s.nodes.length);

  const categories = useMemo(() => Object.keys(CATEGORY_META) as Category[], []);
  // On phones the HUD covers the whole graph — start collapsed there.
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open graph controls"
        className="glass glass-hover absolute left-4 top-4 z-20 flex items-center gap-2 px-3 py-2.5 text-xs text-holo"
      >
        <SlidersHorizontal className="h-4 w-4" /> HUD
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pointer-events-none absolute left-4 top-4 z-20 flex w-[300px] max-w-[calc(100vw-2rem)] flex-col gap-3"
    >
      <div className="pointer-events-auto flex justify-end md:hidden">
        <button onClick={() => setOpen(false)} aria-label="Collapse graph controls" className="btn-ghost !px-2 !py-1">
          <X className="h-3.5 w-3.5" /> hide
        </button>
      </div>
      {/* Search */}
      <div className="pointer-events-auto glass glass-hover flex items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-holo/70" />
        <input
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the brain…"
          aria-label="Search nodes"
          className="!border-0 !bg-transparent !p-0 text-sm"
        />
        {searchQuery && (
          <button aria-label="Clear search" onClick={() => setSearch('')} className="text-steel hover:text-ice">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Focus presets */}
      <div className="pointer-events-auto glass p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="hud-label">Focus Mode</span>
          {focusQuery && (
            <button onClick={() => setFocusQuery(null)} className="flex items-center gap-1 text-[10px] text-alert hover:underline">
              <X className="h-3 w-3" /> exit focus
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setFocusQuery(focusQuery === p.query ? null : p.query)}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] transition-all',
                focusQuery === p.query
                  ? 'border-holo/60 bg-holo/15 text-holo shadow-holo-sm'
                  : 'border-white/10 text-steel hover:border-holo/30 hover:text-ice'
              )}
            >
              <Crosshair className="mr-1 inline h-3 w-3" />
              {p.label}
            </button>
          ))}
        </div>
        {focusQuery && !FOCUS_PRESETS.some((p) => p.query === focusQuery) && (
          <p className="mt-2 text-[11px] text-holo">◎ focused: “{focusQuery}”</p>
        )}
      </div>

      {/* Filters */}
      <div className="pointer-events-auto glass p-3">
        <span className="hud-label">Categories</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const active = activeCategories.includes(c);
            const meta = CATEGORY_META[c];
            return (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-all',
                  active ? 'border-white/25 bg-white/10 text-ice' : 'border-white/10 text-steel hover:text-ice'
                )}
                style={active ? { borderColor: meta.color, boxShadow: `0 0 10px -4px ${meta.color}` } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {NODE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={cn(
                'rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all',
                activeTypes.includes(t)
                  ? 'border-holo/50 bg-holo/10 text-holo'
                  : 'border-white/10 text-steel/70 hover:text-steel'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* View toggle + add */}
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="glass flex overflow-hidden !rounded-lg">
          <button
            onClick={() => setViewMode('3d')}
            aria-pressed={viewMode === '3d'}
            className={cn('flex items-center gap-1 px-3 py-1.5 text-xs', viewMode === '3d' ? 'bg-holo/15 text-holo' : 'text-steel hover:text-ice')}
          >
            <Box className="h-3.5 w-3.5" /> 3D
          </button>
          <button
            onClick={() => setViewMode('2d')}
            aria-pressed={viewMode === '2d'}
            className={cn('flex items-center gap-1 px-3 py-1.5 text-xs', viewMode === '2d' ? 'bg-holo/15 text-holo' : 'text-steel hover:text-ice')}
          >
            <Grid2x2 className="h-3.5 w-3.5" /> 2D
          </button>
        </div>
        <button onClick={onAddNode} className="btn-holo">
          <Plus className="h-3.5 w-3.5" /> Node
        </button>
        <span className="ml-auto font-mono text-[10px] text-steel">{nodeCount} nodes</span>
      </div>
    </motion.div>
  );
});
