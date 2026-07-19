import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatISO } from 'date-fns';
import { Check, Download, FolderOpen, Plug, RefreshCw, Upload, X } from 'lucide-react';
import { ACCENT_PRESETS, applyAccent, useSettingsStore } from '@/stores/settings';
import { useBrainStore } from '@/stores/brain';
import { useOpsStore } from '@/stores/ops';
import { useNotesStore } from '@/stores/notes';
import { useUIStore } from '@/stores/ui';
import { exportJSON, exportMarkdownZip, parseImportedJSON } from '@/lib/dataio';
import { importVaultFolder, pullVault, pushNote, testConnection } from '@/lib/obsidian';
import { cn } from '@/lib/utils';

type Tab = 'intelligence' | 'voice' | 'sync' | 'alerts' | 'graph' | 'appearance' | 'data' | 'obsidian';

const TABS: { id: Tab; label: string }[] = [
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'voice', label: 'Voice' },
  { id: 'sync', label: 'Device Sync' },
  { id: 'alerts', label: 'Notifications' },
  { id: 'graph', label: 'Graph Physics' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Data' },
  { id: 'obsidian', label: 'Obsidian' },
];

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsOpen);
  const setOpen = useUIStore((s) => s.setSettingsOpen);
  const [tab, setTab] = useState<Tab>('intelligence');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="glass flex h-[min(600px,90vh)] w-full max-w-2xl flex-col overflow-hidden border-holo/20 shadow-holo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <h2 className="font-display text-sm font-semibold tracking-widest text-holo">SYSTEM SETTINGS</h2>
              <button aria-label="Close settings" onClick={() => setOpen(false)} className="btn-ghost !p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1">
              <nav className="w-40 shrink-0 space-y-0.5 border-r border-white/10 p-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'block w-full rounded-md px-3 py-2 text-left text-xs transition-colors',
                      tab === t.id ? 'border border-holo/30 bg-holo/10 text-holo' : 'text-steel hover:bg-white/5 hover:text-ice'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
              <div className="flex-1 overflow-y-auto p-5">
                {tab === 'intelligence' && <IntelligenceTab />}
                {tab === 'voice' && <VoiceTab />}
                {tab === 'sync' && <SyncTab />}
                {tab === 'alerts' && <AlertsTab />}
                {tab === 'graph' && <GraphTab />}
                {tab === 'appearance' && <AppearanceTab />}
                {tab === 'data' && <DataTab />}
                {tab === 'obsidian' && <ObsidianTab />}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="hud-label">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[10px] leading-relaxed text-steel/80">{hint}</p>}
    </label>
  );
}

function IntelligenceTab() {
  const s = useSettingsStore();
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');

  const runTest = async () => {
    setTestState('testing');
    setTestMsg('');
    const { generateText } = await import('@/lib/ai');
    const t0 = performance.now();
    const reply = await generateText(
      'You are JARVIS. Reply with exactly: Online and at your service, Sir.',
      'Status check.'
    );
    const ms = Math.round(performance.now() - t0);
    if (reply) {
      setTestState('ok');
      setTestMsg(`“${reply.trim().slice(0, 60)}” · ${ms}ms`);
    } else {
      setTestState('fail');
      setTestMsg(
        s.apiKey
          ? 'The API rejected the call — check the key, model name, and your network. Details in the browser console.'
          : 'No API key set — JARVIS is running on the local parser only.'
      );
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Provider">
        <select value={s.provider} onChange={(e) => s.set({ provider: e.target.value as 'anthropic' | 'openai-compatible' })} className="w-full text-xs">
          <option value="anthropic" className="bg-abyss">Anthropic (Claude) — recommended</option>
          <option value="openai-compatible" className="bg-abyss">OpenAI-compatible (OpenAI / Grok / local)</option>
        </select>
      </Field>
      <Field label="API key" hint="Stored locally in your browser only. Without a key, JARVIS falls back to the on-device command parser — still functional, less clever.">
        <input type="password" value={s.apiKey} onChange={(e) => s.set({ apiKey: e.target.value })} placeholder={s.provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'} className="w-full font-mono text-xs" />
      </Field>
      <Field label="Model">
        <input value={s.model} onChange={(e) => s.set({ model: e.target.value })} className="w-full font-mono text-xs" placeholder="claude-sonnet-5" />
      </Field>
      {s.provider === 'openai-compatible' && (
        <Field label="Base URL">
          <input value={s.baseUrl} onChange={(e) => s.set({ baseUrl: e.target.value })} className="w-full font-mono text-xs" />
        </Field>
      )}
      <Field label="How JARVIS addresses you">
        <input value={s.userName} onChange={(e) => s.set({ userName: e.target.value })} className="w-full text-xs" placeholder="Sir" />
      </Field>
      <div className="border-t border-white/10 pt-4">
        <button onClick={runTest} disabled={testState === 'testing'} className="btn-holo">
          {testState === 'testing' ? 'Contacting intelligence…' : 'Test intelligence connection'}
        </button>
        {testState === 'ok' && <p className="mt-2 text-[11px] text-holo">✓ {testMsg}</p>}
        {testState === 'fail' && <p className="mt-2 text-[11px] leading-relaxed text-alert">✗ {testMsg}</p>}
      </div>
    </div>
  );
}

function VoiceTab() {
  const s = useSettingsStore();
  return (
    <div className="space-y-4">
      <Field label="Recognition language" hint="en-IN gives the best results for Indian English.">
        <select value={s.voiceLang} onChange={(e) => s.set({ voiceLang: e.target.value })} className="w-full text-xs">
          {['en-IN', 'en-US', 'en-GB', 'hi-IN'].map((l) => (
            <option key={l} value={l} className="bg-abyss">{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Always listening" hint="Keeps the recognizer hot between commands. Clear visual indicator on the orb; click the orb any time to kill it.">
        <button
          onClick={() => s.set({ alwaysListening: !s.alwaysListening })}
          className={cn('btn', s.alwaysListening ? 'btn-alert' : 'btn-holo')}
        >
          {s.alwaysListening ? 'ARMED — click to disarm' : 'Off — click to arm'}
        </button>
      </Field>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-steel">
        <p className="mb-1 font-medium text-ice">Try saying:</p>
        <p>“Show me everything connected to the Europe trip”</p>
        <p>“Add this as a new brain node linked to music production and Bali: …”</p>
        <p>“Remind me to call the vendor tomorrow”</p>
        <p>“Optimize tomorrow around my workout and protect focus time”</p>
        <p>“What have I been ignoring lately?”</p>
      </div>
    </div>
  );
}

function SyncTab() {
  const s = useSettingsStore();
  const toast = useUIStore((t) => t.toast);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const runSync = async () => {
    setBusy(true);
    const { syncNow, getSyncStatus } = await import('@/lib/sync');
    const r = await syncNow();
    setStatus(getSyncStatus());
    toast(r.ok ? `⇄ ${r.msg}` : `Sync failed: ${r.msg}`, r.ok ? 'success' : 'alert');
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-steel">
        Sync keeps every device on the same brain via a <span className="text-ice">secret GitHub Gist</span> in your account.
        Create a token at <span className="font-mono text-ice">github.com/settings/tokens</span> → Generate new token
        (classic) → tick only the <span className="font-mono text-ice">gist</span> scope. Paste the same token on your PC
        and your phone. Newest change wins.
      </p>
      <Field label="GitHub token (gist scope only)">
        <input type="password" value={s.syncToken} onChange={(e) => s.set({ syncToken: e.target.value })} placeholder="ghp_…" className="w-full font-mono text-xs" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={runSync} disabled={busy || !s.syncToken} className="btn-holo disabled:opacity-40">
          <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} /> Sync now
        </button>
        <button
          onClick={() => s.set({ autoSync: !s.autoSync })}
          className={cn('btn', s.autoSync ? 'btn-holo' : 'btn-ghost border border-white/10')}
        >
          Auto-sync: {s.autoSync ? 'ON' : 'OFF'}
        </button>
      </div>
      <p className="font-mono text-[10px] text-steel">
        {status || (s.lastSyncAt ? `last sync ${s.lastSyncAt.slice(0, 16).replace('T', ' ')}` : 'not synced yet')}
        {s.syncGistId && <> · gist {s.syncGistId.slice(0, 8)}…</>}
      </p>
    </div>
  );
}

function AlertsTab() {
  const toast = useUIStore((t) => t.toast);
  const [perm, setPerm] = useState<string>('checking');

  useEffect(() => {
    void import('@/lib/notify').then((m) => setPerm(m.notificationPermission()));
  }, []);

  const enable = async () => {
    const m = await import('@/lib/notify');
    const ok = await m.enableNotifications();
    setPerm(m.notificationPermission());
    if (ok) {
      m.fireNotification('JARVIS online', 'Notifications armed, Sir. Reminders will announce themselves.');
      toast('Notifications enabled', 'success');
    } else {
      toast('Permission denied — enable it in browser/site settings', 'alert');
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Status">
        <p className={cn('text-xs', perm === 'granted' ? 'text-holo' : 'text-steel')}>
          {perm === 'granted' ? '✓ Enabled on this device' : perm === 'denied' ? '✗ Blocked in browser settings' : perm === 'unsupported' ? 'Not supported in this browser' : 'Not enabled yet'}
        </p>
      </Field>
      {perm !== 'granted' && perm !== 'unsupported' && (
        <button onClick={enable} className="btn-holo">Enable notifications</button>
      )}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-steel">
        <p className="mb-1 font-medium text-ice">What fires, and when</p>
        <p>· Reminders announce themselves at their set time.</p>
        <p>· A 9 AM digest lists tasks due today.</p>
        <p className="mt-2 text-steel/80">
          Honest limitation: the browser only delivers these while JARVIS is open — including backgrounded or installed
          as an app. Push that reaches a fully-closed phone needs a small server; say the word and it gets built.
        </p>
      </div>
    </div>
  );
}

function GraphTab() {
  const physics = useSettingsStore((s) => s.physics);
  const setPhysics = useSettingsStore((s) => s.setPhysics);
  const Slider = ({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) => (
    <Field label={`${label} — ${value}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--holo)] !p-0" />
    </Field>
  );
  return (
    <div className="space-y-4">
      <Slider label="Repulsion" value={physics.chargeStrength} min={-400} max={-20} step={10} onChange={(v) => setPhysics({ chargeStrength: v })} />
      <Slider label="Link distance" value={physics.linkDistance} min={20} max={160} step={5} onChange={(v) => setPhysics({ linkDistance: v })} />
      <Slider label="Damping" value={physics.velocityDecay} min={0.1} max={0.7} step={0.02} onChange={(v) => setPhysics({ velocityDecay: v })} />
      <Slider label="Particle speed" value={physics.particleSpeed} min={0.002} max={0.02} step={0.002} onChange={(v) => setPhysics({ particleSpeed: v })} />
    </div>
  );
}

function AppearanceTab() {
  const accent = useSettingsStore((s) => s.accent);
  const set = useSettingsStore((s) => s.set);
  return (
    <div className="space-y-4">
      <Field label="Accent color">
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => { set({ accent: p.value }); applyAccent(p.value); }}
              className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all', accent === p.value ? 'border-white/40 bg-white/10 text-ice' : 'border-white/10 text-steel hover:text-ice')}
            >
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.value, boxShadow: `0 0 8px ${p.value}` }} />
              {p.label}
              {accent === p.value && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function DataTab() {
  const toast = useUIStore((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <button
        onClick={() => {
          const b = useBrainStore.getState();
          const o = useOpsStore.getState();
          exportJSON({ nodes: b.nodes, manualLinks: b.manualLinks, tasks: o.tasks, events: o.events });
        }}
        className="btn-holo w-full justify-center"
      >
        <Download className="h-3.5 w-3.5" /> Export everything (JSON)
      </button>
      <button onClick={() => void exportMarkdownZip(useBrainStore.getState().nodes)} className="btn-holo w-full justify-center">
        <Download className="h-3.5 w-3.5" /> Export brain as Markdown (.zip, Obsidian-ready)
      </button>
      <button onClick={() => fileRef.current?.click()} className="btn-ghost w-full justify-center border border-white/10">
        <Upload className="h-3.5 w-3.5" /> Import JSON backup
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const bundle = await parseImportedJSON(f);
            useBrainStore.getState().importData(bundle.nodes, bundle.manualLinks ?? [], false);
            if (bundle.tasks) useOpsStore.setState({ tasks: bundle.tasks, events: bundle.events ?? [] });
            toast(`Imported ${bundle.nodes.length} nodes`, 'success');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Import failed', 'alert');
          }
          e.target.value = '';
        }}
      />
      <button onClick={() => folderRef.current?.click()} className="btn-ghost w-full justify-center border border-white/10">
        <FolderOpen className="h-3.5 w-3.5" /> Import Obsidian vault folder (.md files)
      </button>
      <input
        ref={folderRef}
        type="file"
        className="hidden"
        // @ts-expect-error non-standard but universally supported directory picker
        webkitdirectory=""
        multiple
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          try {
            const nodes = await importVaultFolder(e.target.files);
            useBrainStore.getState().importData(nodes, [], true);
            toast(`Merged ${nodes.length} vault notes into the brain`, 'success');
          } catch {
            toast('Vault import failed', 'alert');
          }
          e.target.value = '';
        }}
      />
      <div className="border-t border-white/10 pt-3">
        <button
          onClick={() => {
            if (confirm('Reset ALL data back to the demo seed? Your current brain, notes, tasks and events will be replaced.')) {
              useBrainStore.getState().resetToSeed();
              useOpsStore.getState().resetToSeed();
              useNotesStore.getState().resetToSeed();
              toast('Central core reset to seed data', 'info');
            }
          }}
          className="btn-alert w-full justify-center"
        >
          Reset to seed data
        </button>
      </div>
    </div>
  );
}

function ObsidianTab() {
  const obsidian = useSettingsStore((s) => s.obsidian);
  const setObsidian = useSettingsStore((s) => s.setObsidian);
  const toast = useUIStore((s) => s.toast);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const connect = async () => {
    setBusy('connect');
    try {
      const ok = await testConnection(obsidian);
      setObsidian({ connected: ok });
      toast(ok ? 'Obsidian vault linked' : 'Connection refused — check plugin, port and key', ok ? 'success' : 'alert');
    } catch {
      setObsidian({ connected: false });
      toast('Could not reach Obsidian. Is the Local REST API plugin running?', 'alert');
    } finally {
      setBusy(null);
    }
  };

  const pull = async () => {
    setBusy('pull');
    try {
      const nodes = await pullVault(obsidian, (d, t) => setProgress(`${d}/${t}`));
      useBrainStore.getState().importData(nodes, [], true);
      setObsidian({ lastSync: formatISO(new Date()) });
      toast(`Pulled ${nodes.length} notes from the vault`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Pull failed', 'alert');
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  const push = async () => {
    setBusy('push');
    try {
      const nodes = useBrainStore.getState().nodes;
      let pushed = 0;
      for (const n of nodes) {
        await pushNote(obsidian, n);
        pushed++;
        setProgress(`${pushed}/${nodes.length}`);
      }
      setObsidian({ lastSync: formatISO(new Date()) });
      toast(`Pushed ${pushed} notes (new ones under JARVIS/)`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Push failed', 'alert');
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-steel">
        Requires the community plugin <span className="text-ice">“Local REST API”</span> in Obsidian. Enable it, copy the API key,
        and prefer the <span className="font-mono text-ice">http://127.0.0.1:27123</span> (insecure HTTP) endpoint — the HTTPS one uses a
        self-signed certificate browsers reject.
      </p>
      <Field label="Endpoint">
        <input value={obsidian.baseUrl} onChange={(e) => setObsidian({ baseUrl: e.target.value, connected: false })} className="w-full font-mono text-xs" />
      </Field>
      <Field label="API key">
        <input type="password" value={obsidian.apiKey} onChange={(e) => setObsidian({ apiKey: e.target.value, connected: false })} className="w-full font-mono text-xs" />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={connect} disabled={busy !== null} className="btn-holo">
          <Plug className="h-3.5 w-3.5" /> {busy === 'connect' ? 'Testing…' : obsidian.connected ? 'Re-test connection' : 'Connect'}
        </button>
        {obsidian.connected && <span className="flex items-center gap-1 text-[11px] text-holo"><Check className="h-3 w-3" /> linked</span>}
      </div>
      {obsidian.connected && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <button onClick={pull} disabled={busy !== null} className="btn-holo w-full justify-center">
            <RefreshCw className={cn('h-3.5 w-3.5', busy === 'pull' && 'animate-spin')} /> Pull vault → brain {busy === 'pull' && progress}
          </button>
          <button onClick={push} disabled={busy !== null} className="btn-ghost w-full justify-center border border-white/10">
            <Upload className="h-3.5 w-3.5" /> Push brain → vault {busy === 'push' && progress}
          </button>
          <p className="text-[10px] leading-relaxed text-steel/80">
            Pull merges by title (vault wins). Push writes vault-born notes back in place and exports app-born nodes to a{' '}
            <span className="font-mono">JARVIS/</span> folder — your vault is never clobbered.
            {obsidian.lastSync && <> Last sync: {obsidian.lastSync.slice(0, 16).replace('T', ' ')}.</>}
          </p>
        </div>
      )}
    </div>
  );
}
