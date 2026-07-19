import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUIStore, type AppView } from '@/stores/ui';
import { applyAccent, useSettingsStore } from '@/stores/settings';
import { isTypingTarget } from '@/lib/utils';
import { GodsEye } from '@/components/godseye/GodsEye';
import { Operations } from '@/components/operations/Operations';
import { NotesView } from '@/components/notes/NotesView';
import { HUDBar } from '@/components/shared/HUDBar';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { SettingsModal } from '@/components/shared/SettingsModal';
import { Toasts } from '@/components/shared/Toasts';
import { VoiceOrb } from '@/components/voice/VoiceOrb';
import { CommandDeck } from '@/components/voice/CommandDeck';
import { useVoice } from '@/components/voice/useVoice';

export default function App() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const voice = useVoice();

  // Boot: accent, cross-device sync, notification scheduler.
  useEffect(() => {
    applyAccent(useSettingsStore.getState().accent);
    void import('@/lib/sync').then((m) => m.initSync());
    void import('@/lib/notify').then((m) => m.initNotificationScheduler());
  }, []);

  // Obsidian auto-sync: while the desktop app is open and the vault is linked, pull
  // every 10 minutes. Changes then ride the device sync out to the phone automatically.
  useEffect(() => {
    const pull = async () => {
      const { obsidian } = useSettingsStore.getState();
      if (!obsidian.connected || !obsidian.apiKey) return;
      try {
        const { pullVault } = await import('@/lib/obsidian');
        const { useBrainStore } = await import('@/stores/brain');
        const nodes = await pullVault(obsidian);
        if (nodes.length) useBrainStore.getState().importData(nodes, [], true);
      } catch {
        /* vault offline — try again next cycle */
      }
    };
    const t = setInterval(() => void pull(), 10 * 60 * 1000);
    setTimeout(() => void pull(), 8000);
    return () => clearInterval(t);
  }, []);

  // Global shortcuts: 1 / 2 / 3 switch views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '1') setView('godseye');
      if (e.key === '2') setView('operations');
      if (e.key === '3') setView('notes');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView]);

  /*
   * All three views stay MOUNTED and we animate opacity only. This is deliberate:
   * unmounting God's Eye on every switch created a fresh WebGL context each time,
   * and Chrome silently kills the oldest context after ~16 — the graph went blank.
   * One mount = one context for the app's lifetime, and switching is instant.
   */
  const views: { id: AppView; el: React.ReactNode }[] = [
    { id: 'godseye', el: <GodsEye startVoice={voice.start} active={view === 'godseye'} /> },
    { id: 'operations', el: <Operations /> },
    { id: 'notes', el: <NotesView /> },
  ];

  return (
    <div className="atmosphere relative flex h-full flex-col overflow-hidden">
      <HUDBar />
      <main className="relative min-h-0 flex-1">
        {views.map((v) => {
          const active = view === v.id;
          return (
            <div
              key={v.id}
              className={`view-layer ${active ? 'on' : 'off'}`}
              style={{ zIndex: active ? 1 : 0 }}
              aria-hidden={!active}
            >
              {v.el}
            </div>
          );
        })}
      </main>

      <VoiceOrb voice={voice} />
      <CommandDeck />
      <CommandPalette startVoice={voice.start} />
      <SettingsModal />
      <Toasts />
    </div>
  );
}
