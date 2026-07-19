# JARVIS Command Core

> Your personal AI operating system — knowledge, execution, and daily mastery in one place.

A cinematic, local-first PWA with two holographic views and a voice command layer:

- **GOD'S EYE** — an immersive 3D force-directed map of your second brain. Nodes are notes / projects / people / ideas, colored by life-category; edges come from `[[wikilinks]]` in your markdown plus manual links. Search dims non-matches, Focus Mode isolates subgraphs, and every node opens a glass detail panel with rendered markdown, connection management, and JARVIS link suggestions.
- **OPERATIONS** — daily command center: in-character AI briefing, a 5-day draggable timeline (drag tasks in, drag blocks to retime; 🔒 protected blocks survive replanning), a prioritized Mission Queue, and an Intelligence Feed that derives conflicts, overdue work, and "going quiet" insights automatically.
- **JARVIS Voice** — hold **Space** (or click the orb) and speak. Live waveform → transcription → LLM analysis → a preview of proposed structured actions you confirm before anything executes. Works offline via a deterministic local parser when no API key is set.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5199
npm run build      # production build + PWA (installable, offline app shell)
```

## Adding your Claude key

Settings (gear icon) → **Intelligence** → paste your Anthropic API key (`sk-ant-…`).
Model defaults to `claude-sonnet-5`. Keys live only in your browser's localStorage.
The client calls the Messages API directly with forced tool-use for guaranteed structured JSON
(`src/lib/ai.ts`) — no SDK dependency, and an OpenAI-compatible mode (OpenAI / Grok / local
llama.cpp etc.) is one dropdown away.

Without a key, voice commands still work through `localAnalyze()` — a rule-based parser that
handles capture, tasks, reminders, graph focus, and day replanning.

## Voice

- **Push-to-talk:** hold `Space` anywhere (outside text fields), release to submit.
- **Toggle:** click the orb. **Always Listening:** arm it in Settings → Voice (red dot on the orb = armed; click the orb to kill).
- Language priority `en-IN` (configurable). Requires Chrome/Edge (Web Speech API).
- Every command ends in a **Command Deck preview** — untick any proposed action, then Execute.

Try: *"Show me everything connected to the Europe trip"* · *"Remind me to call the vendor tomorrow"* · *"Optimize tomorrow around my workout and protect focus time"* · *"What have I been ignoring lately?"*

## Obsidian integration

**Zero-setup path:** Settings → Data → *Import Obsidian vault folder* (reads `.md`, parses frontmatter, `[[wikilinks]]`, `#tags`). Export back any time as an Obsidian-ready markdown zip.

**Live sync path:** install the community plugin **Local REST API** in Obsidian → enable → copy its API key → Settings → Obsidian → endpoint `http://127.0.0.1:27123` (use the HTTP port; the HTTPS one has a self-signed cert browsers reject) → Connect.
- **Pull** merges vault → brain (matched by title, vault wins).
- **Push** writes vault-born notes back in place; app-born nodes export to a `JARVIS/` folder so your vault is never clobbered.

## Architecture

```
src/
  components/godseye/     GraphCanvas (3D/2D), HUD, NodeDetail
  components/operations/  Briefing, Timeline, TaskList, Feed
  components/voice/       useVoice hook, pipeline, VoiceOrb, CommandDeck
  components/shared/      HUDBar, CommandPalette (⌘K), SettingsModal, Toasts
  lib/                    ai.ts (prompting + providers), graph.ts (wikilink/search/subgraph),
                          actions.ts (AIAction executor), briefing.ts, obsidian.ts, dataio.ts
  stores/                 Zustand: brain, ops, settings, ui  (brain/ops persist to IndexedDB)
  types/                  All domain types
```

- **Graph engine:** `react-force-graph-3d` (three.js + d3-force-3d) over hand-rolled R3F physics — battle-tested simulation, built-in link particles and camera tweening, an order of magnitude less custom code on the 60fps hot path. Clean 2D canvas fallback included.
- **Persistence:** IndexedDB via `idb-keyval` behind Zustand `persist` — local-first; JSON + Markdown zip export/import for durability.
- **Keyboard:** `⌘/Ctrl+K` palette · `1`/`2` switch views · hold `Space` to talk · `Esc` closes overlays.

## Bringing in real data

1. Import your vault (either path above) — the demo seed can be cleared via Settings → Data → Reset, or just import with merge.
2. Tasks/events accrue from voice commands, quick actions, and "Sync from God's Eye" (pulls task-type nodes into the queue).
3. Everything exports losslessly (Settings → Data) — you are never locked in.
