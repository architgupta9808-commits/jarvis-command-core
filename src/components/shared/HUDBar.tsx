import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Command, Settings } from 'lucide-react';
import { useUIStore, type AppView } from '@/stores/ui';
import { cn } from '@/lib/utils';

const NAV: { id: AppView; label: string }[] = [
  { id: 'godseye', label: "GOD'S EYE" },
  { id: 'operations', label: 'OPERATIONS' },
  { id: 'notes', label: 'NOTES' },
];

export const HUDBar = memo(function HUDBar() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const setCommandPalette = useUIStore((s) => s.setCommandPalette);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const [clock, setClock] = useState(() => new Date());
  const sigilRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000 * 20);
    return () => clearInterval(t);
  }, []);

  // The notes capture animation targets the sigil; pulse it on arrival.
  useEffect(() => {
    const el = sigilRef.current;
    if (!el) return;
    const onPulse = () => {
      el.animate(
        [
          { boxShadow: '0 0 18px -6px var(--holo-glow)', transform: 'scale(1)' },
          { boxShadow: '0 0 34px -2px var(--holo-glow)', transform: 'scale(1.25)' },
          { boxShadow: '0 0 18px -6px var(--holo-glow)', transform: 'scale(1)' },
        ],
        { duration: 700, easing: 'ease-out' }
      );
    };
    window.addEventListener('jarvis:brain-pulse', onPulse);
    return () => window.removeEventListener('jarvis:brain-pulse', onPulse);
  }, []);

  return (
    <header className="relative z-30 flex h-[60px] shrink-0 items-center gap-3 border-b border-holo/15 bg-abyss/60 px-3 backdrop-blur-xl md:gap-6 md:px-6">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <span
          id="brain-sigil"
          ref={sigilRef}
          className="grid h-[30px] w-[30px] place-items-center rounded-full border border-holo/30"
          style={{ boxShadow: '0 0 18px -6px var(--holo-glow), inset 0 0 10px -4px var(--holo-glow)' }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: 'radial-gradient(circle at 35% 35%, #F5DFAC, var(--holo) 60%, #8a6f3a)' }}
          />
        </span>
        <div className="hidden font-display text-[15px] tracking-[0.26em] text-ice lg:block">
          JARVIS <span className="text-holo">· COMMAND CORE</span>
        </div>
      </div>

      {/* View nav */}
      <nav className="flex items-center gap-1 lg:absolute lg:left-1/2 lg:-translate-x-1/2" aria-label="Primary views">
        {NAV.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={cn(
              'relative px-2.5 py-2 text-[11.5px] tracking-[0.06em] transition-colors duration-200 md:px-4 md:text-[12.5px] md:tracking-[0.08em]',
              view === v.id ? 'text-holo' : 'text-steel hover:text-ice'
            )}
          >
            {v.label}
            {view === v.id && (
              <motion.span
                layoutId="nav-underline"
                className="absolute inset-x-3 bottom-1 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, var(--holo), transparent)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-4">
        <button
          onClick={() => setCommandPalette(true)}
          className="hidden items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-steel transition-colors hover:border-holo/30 hover:text-ice sm:flex"
          aria-label="Open command palette"
        >
          <Command className="h-3 w-3" /> K
        </button>
        <div className="hidden text-right leading-tight sm:block">
          <div className="font-mono text-xs text-ice">{format(clock, 'HH:mm')}</div>
          <div className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-faint md:block">
            {format(clock, 'EEE d MMM')}
          </div>
        </div>
        <button onClick={() => setSettingsOpen(true)} aria-label="Settings" className="btn-ghost !p-1.5">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
});
