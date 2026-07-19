import { memo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { useUIStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { isTypingTarget } from '@/lib/utils';
import type { VoiceState } from './useVoice';

/**
 * The persistent JARVIS orb. Click to toggle listening; hold SPACE for push-to-talk.
 * Renders a live waveform ring while listening.
 */
export const VoiceOrb = memo(function VoiceOrb({ voice }: { voice: VoiceState }) {
  const deckStatus = useUIStore((s) => s.deckStatus);
  const alwaysListening = useSettingsStore((s) => s.alwaysListening);

  // Push-to-talk: hold Space anywhere outside inputs.
  useEffect(() => {
    let held = false;
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || held || isTypingTarget(e.target)) return;
      if (useUIStore.getState().commandPaletteOpen || useUIStore.getState().settingsOpen) return;
      held = true;
      e.preventDefault();
      voice.start();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !held) return;
      held = false;
      e.preventDefault();
      voice.stop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [voice]);

  const busy = deckStatus === 'analyzing' || deckStatus === 'executing';
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  // On phones the deck needs the whole bottom edge — get out of its way.
  const deckOpen = deckStatus !== 'idle';

  return (
    <div
      className={`fixed right-4 z-40 flex flex-col items-center gap-2 transition-opacity duration-200 md:right-6 ${
        deckOpen ? 'max-md:pointer-events-none max-md:opacity-0' : ''
      }`}
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      {voice.error && (
        <div className="glass max-w-[240px] px-3 py-2 text-[11px] text-alert border-alert/30">{voice.error}</div>
      )}
      <motion.button
        aria-label={voice.listening ? 'Stop listening' : 'Start voice command (or hold Space)'}
        onClick={voice.toggle}
        whileTap={{ scale: 0.92 }}
        className="relative grid h-16 w-16 place-items-center rounded-full focus-visible:outline-holo"
      >
        {/* Outer glow ring */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 32px -4px var(--holo-glow), inset 0 0 18px -6px var(--holo-glow)' }}
          animate={
            voice.listening
              ? { scale: [1, 1.12, 1], opacity: [0.9, 1, 0.9] }
              : busy
                ? { rotate: 360 }
                : { scale: [1, 1.04, 1], opacity: [0.55, 0.75, 0.55] }
          }
          transition={
            busy
              ? { duration: 1.4, repeat: Infinity, ease: 'linear' }
              : { duration: voice.listening ? 1.2 : 3.2, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        {/* Waveform ring */}
        {voice.listening && (
          <svg className="pointer-events-none absolute -inset-3" viewBox="0 0 100 100">
            {voice.levels.map((lv, i) => {
              const angle = (i / voice.levels.length) * Math.PI * 2 - Math.PI / 2;
              const r0 = 38;
              const r1 = 38 + lv * 12;
              return (
                <line
                  key={i}
                  x1={50 + Math.cos(angle) * r0}
                  y1={50 + Math.sin(angle) * r0}
                  x2={50 + Math.cos(angle) * r1}
                  y2={50 + Math.sin(angle) * r1}
                  stroke="var(--holo)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity={0.4 + lv * 0.6}
                />
              );
            })}
          </svg>
        )}
        {/* Core */}
        <span
          className="relative grid h-14 w-14 place-items-center rounded-full border border-holo/40 bg-abyss/90 backdrop-blur-xl"
          style={{ boxShadow: 'inset 0 0 20px -6px var(--holo-glow)' }}
        >
          {voice.supported ? (
            <Mic className={voice.listening ? 'h-5 w-5 text-holo' : 'h-5 w-5 text-holo/70'} />
          ) : (
            <MicOff className="h-5 w-5 text-steel" />
          )}
        </span>
        {alwaysListening && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-alert shadow-alert" title="Always listening armed" />
        )}
      </motion.button>
      <span className="hud-label select-none">
        {voice.listening ? 'listening' : busy ? 'processing' : isTouch ? 'tap to speak' : 'hold space'}
      </span>
    </div>
  );
});
