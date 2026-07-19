import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LLMProvider, ObsidianSettings, PhysicsSettings } from '@/types';

export const ACCENT_PRESETS = [
  { label: 'Champagne Gold', value: '#E6C37C' },
  { label: 'Holographic Cyan', value: '#7FD8E5' },
  { label: 'Vibranium Violet', value: '#B49AE8' },
  { label: 'Jade Circuit', value: '#7FC9A2' },
  { label: 'Ember', value: '#E2A85C' },
];

interface SettingsState {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  /** For openai-compatible providers (OpenAI, Grok, local, etc.) */
  baseUrl: string;
  voiceLang: string;
  alwaysListening: boolean;
  userName: string;
  accent: string;
  physics: PhysicsSettings;
  obsidian: ObsidianSettings;
  /** GitHub token (gist scope) powering cross-device sync. */
  syncToken: string;
  syncGistId: string;
  autoSync: boolean;
  lastSyncAt: string;

  set: (patch: Partial<SettingsState>) => void;
  setPhysics: (patch: Partial<PhysicsSettings>) => void;
  setObsidian: (patch: Partial<ObsidianSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: 'anthropic',
      apiKey: '',
      model: 'claude-sonnet-5',
      baseUrl: 'https://api.openai.com/v1',
      voiceLang: 'en-IN',
      alwaysListening: false,
      userName: 'Sir',
      accent: '#E6C37C',
      physics: { chargeStrength: -120, linkDistance: 55, velocityDecay: 0.32, particleSpeed: 0.006 },
      obsidian: { baseUrl: 'http://127.0.0.1:27123', apiKey: '', connected: false },
      syncToken: '',
      syncGistId: '',
      autoSync: true,
      lastSyncAt: '',

      set: (patch) => set(patch),
      setPhysics: (patch) => set((s) => ({ physics: { ...s.physics, ...patch } })),
      setObsidian: (patch) => set((s) => ({ obsidian: { ...s.obsidian, ...patch } })),
    }),
    {
      name: 'jarvis-settings',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as Partial<SettingsState>;
        // v1 → v2: Obsidian & Gold retheme — carry users off the old cyan default.
        if (version < 2 && s.accent === '#00f0ff') s.accent = '#E6C37C';
        return s as SettingsState;
      },
    }
  )
);

/** Apply the accent color to CSS variables so the whole UI retints. */
export function applyAccent(hex: string) {
  const root = document.documentElement;
  root.style.setProperty('--holo', hex);
  const rgb = hexToRgb(hex);
  if (rgb) {
    root.style.setProperty('--holo-rgb', `${rgb.r} ${rgb.g} ${rgb.b}`);
    root.style.setProperty('--holo-dim', `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`);
    root.style.setProperty('--holo-glow', `rgba(${rgb.r},${rgb.g},${rgb.b},0.45)`);
    root.style.setProperty('--holo-faint', `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`);
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
