import { format, addDays } from 'date-fns';
import type { AIAction, AIAnalysis, BrainNode, CalendarEvent, Category, Task } from '@/types';
import { useSettingsStore } from '@/stores/settings';
import { useLiveStore } from '@/stores/live';

/**
 * The intelligence core.
 *
 * Provider-agnostic by design: a thin typed client over fetch —
 *  - Anthropic Messages API with forced tool-use (guaranteed structured JSON)
 *  - Any OpenAI-compatible endpoint (OpenAI / Grok / local) via JSON mode
 *  - A deterministic local parser as offline fallback, so the app is useful with no key at all.
 */

export interface AIContext {
  nodeTitles: string[];
  pendingTasks: Pick<Task, 'title' | 'priority' | 'due'>[];
  todayEvents: Pick<CalendarEvent, 'title' | 'startMin' | 'durationMin' | 'protected'>[];
  userName: string;
}

const CATEGORIES: Category[] = ['business', 'music', 'health', 'travel', 'family', 'ideas', 'personal'];

/* ------------------------------------------------------------------ */
/* Prompt engineering                                                  */
/* ------------------------------------------------------------------ */

function systemPrompt(ctx: AIContext): string {
  const today = new Date();
  return `You are JARVIS — a calm, precise, subtly witty personal AI chief-of-staff. You serve a high-agency owner-operator who runs a multi-store jewellery retail business, produces electronic music, optimises health, travels well, and protects family time.

Your single job here: convert one spoken command into STRUCTURED ACTIONS against their personal system, plus one short in-character reply (1–2 sentences, address them as "${ctx.userName}", never sycophantic, dry wit welcome).

TODAY is ${format(today, 'EEEE, d MMMM yyyy')}. Dates in actions are ISO yyyy-MM-dd ("tomorrow" = ${format(addDays(today, 1), 'yyyy-MM-dd')}). Times are minutes from midnight (14:00 = 840).

CATEGORIES: ${CATEGORIES.join(', ')}.

EXISTING BRAIN NODES (link new content to these when relevant — use exact titles):
${ctx.nodeTitles.slice(0, 120).join(' | ')}

PENDING TASKS: ${ctx.pendingTasks.slice(0, 25).map((t) => `${t.title} [${t.priority}${t.due ? `, due ${t.due}` : ''}]`).join('; ') || 'none'}

TODAY'S CALENDAR: ${ctx.todayEvents.map((e) => `${e.title} @${Math.floor(e.startMin / 60)}:${String(e.startMin % 60).padStart(2, '0')} for ${e.durationMin}m${e.protected ? ' [PROTECTED]' : ''}`).join('; ') || 'empty'}

RULES:
1. Prefer few, high-quality actions. Never invent work the user didn't imply.
2. UPDATE, DON'T DUPLICATE: if the command references content that matches an EXISTING node title ("open X", "add Y to X", "append to X", "update X", "in my note about X…") → use update_node (appendContent for additions) or open_node (just viewing). create_node is ONLY for genuinely new material. Recreating or reciting an existing note is a failure.
3. "Open / show me my note on X" → open_node. "Show me everything connected to X" → focus_graph (and switch_view to godseye).
4. New brain nodes: write genuinely useful markdown content (a heading, 2–5 bullets expanding the idea), pick the best category/tags, and populate linkTo with EXACT existing node titles that are truly related (1–4 links).
5. Planning requests ("optimize tomorrow", "replan my day") → plan_day with realistic blocks 07:00–22:00; NEVER move blocks marked [PROTECTED] — re-emit them unchanged with protected true; include gym/focus blocks when asked to protect them.
6. Reflection questions ("what have I been ignoring?") → notify actions with kind "insight" summarising neglected areas from the context.
7. Destructive requests ("delete all my operations / tasks / events", "clear my planner", "wipe my day") → clear_operations with scope tasks | events | all ("operations" means all). Acknowledge soberly.
8. If the command is ambiguous, do the most probable small thing and say what you assumed.${learnedRulesBlock()}`;
}

/** Corrections distilled nightly from Archit's flagged misfires — the self-improvement loop. */
function learnedRulesBlock(): string {
  const rules = useLiveStore.getState().learnedRules;
  if (!rules.length) return '';
  return `\n\nLEARNED CORRECTIONS (from the user's past feedback — these override your instincts):\n${rules
    .slice(0, 15)
    .map((r, i) => `${i + 1}. ${r}`)
    .join('\n')}`;
}

const ANALYSIS_SCHEMA = {
  type: 'object' as const,
  properties: {
    reply: { type: 'string', description: 'Short in-character JARVIS reply, 1–2 sentences.' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'create_node', 'update_node', 'create_task', 'complete_task', 'create_event',
              'focus_graph', 'open_node', 'switch_view', 'plan_day', 'notify', 'clear_operations',
            ],
          },
          title: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES as unknown as string[] },
          nodeType: { type: 'string', enum: ['note', 'project', 'task', 'person', 'idea', 'event'] },
          tags: { type: 'array', items: { type: 'string' } },
          linkTo: { type: 'array', items: { type: 'string' } },
          query: { type: 'string' },
          appendContent: { type: 'string' },
          addTags: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'] },
          due: { type: 'string' },
          date: { type: 'string' },
          startMin: { type: 'number' },
          durationMin: { type: 'number' },
          protected: { type: 'boolean' },
          view: { type: 'string', enum: ['godseye', 'operations', 'notes'] },
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                startMin: { type: 'number' },
                durationMin: { type: 'number' },
                category: { type: 'string', enum: CATEGORIES as unknown as string[] },
                protected: { type: 'boolean' },
              },
              required: ['title', 'startMin', 'durationMin'],
            },
          },
          kind: { type: 'string', enum: ['reminder', 'conflict', 'opportunity', 'insight', 'alert'] },
          body: { type: 'string' },
          scope: { type: 'string', enum: ['tasks', 'events', 'all'] },
        },
        required: ['type'],
      },
    },
  },
  required: ['reply', 'actions'],
};

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

async function callAnthropic(system: string, user: string, apiKey: string, model: string): Promise<AIAnalysis> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [
        {
          name: 'submit_analysis',
          description: 'Submit the structured analysis of the voice command.',
          input_schema: ANALYSIS_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_analysis' },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const toolUse = (data.content as { type: string; input?: unknown }[]).find((b) => b.type === 'tool_use');
  if (!toolUse?.input) throw new Error('No structured output returned.');
  return normalizeAnalysis(toolUse.input as Record<string, unknown>);
}

async function callOpenAICompatible(system: string, user: string, apiKey: string, model: string, baseUrl: string): Promise<AIAnalysis> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${system}\n\nRespond ONLY with JSON matching: {"reply": string, "actions": Action[]}.` },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty LLM response.');
  return normalizeAnalysis(JSON.parse(raw));
}

/** Coerce loosely-shaped LLM output into a safe AIAnalysis. */
function normalizeAnalysis(raw: Record<string, unknown>): AIAnalysis {
  const actions = Array.isArray(raw.actions) ? (raw.actions as AIAction[]) : [];
  return {
    reply: typeof raw.reply === 'string' && raw.reply ? raw.reply : 'Done, Sir.',
    actions: actions.filter((a) => a && typeof a === 'object' && typeof (a as { type?: string }).type === 'string'),
  };
}

/* ------------------------------------------------------------------ */
/* Local fallback parser (no API key / offline)                        */
/* ------------------------------------------------------------------ */

export function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/(store|shop|inventory|vendor|staff|customer|sale|jewel|gold|marketing|campaign|karigar|polki|kundan|solitaire|showroom|hallmark|melt|exchange|counter|billing|stock|priya|diamond|silver)/.test(t)) return 'business';
  if (/(music|track|ableton|synth|edm|dj|mix|studio|song)/.test(t)) return 'music';
  if (/(gym|workout|sleep|health|protein|run|doctor|blood)/.test(t)) return 'health';
  if (/(trip|travel|flight|hotel|bali|europe|italy|amsterdam|safari|visa)/.test(t)) return 'travel';
  if (/(family|mom|dad|parents|cousin|sister|brother|anniversary)/.test(t)) return 'family';
  return 'ideas';
}

export function localAnalyze(transcript: string, ctx: AIContext): AIAnalysis {
  const t = transcript.trim();
  const lower = t.toLowerCase();
  const cat = guessCategory(t);
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  // "show me everything connected to X" / "find X"
  const show = lower.match(/(?:show me|show|find|search for|what'?s connected to)\s+(?:everything connected to\s+)?(.{3,})/);
  if (show && /show|connected|find|search/.test(lower)) {
    return {
      reply: `Pulling up everything connected to “${show[1].trim()}”, ${ctx.userName}.`,
      actions: [
        { type: 'switch_view', view: 'godseye' },
        { type: 'focus_graph', query: show[1].trim() },
      ],
    };
  }

  // "delete all my operations / tasks / events"
  const wipe = lower.match(/(?:delete|clear|wipe|remove)\s+(?:all\s+)?(?:my\s+)?(operations?|tasks?|events?|planner|day)/);
  if (wipe) {
    const scope = /task/.test(wipe[1]) ? 'tasks' as const : /event/.test(wipe[1]) ? 'events' as const : 'all' as const;
    return {
      reply: `Understood, ${ctx.userName}. Clearing ${scope === 'all' ? 'all operations — tasks and calendar' : scope}. This is not reversible.`,
      actions: [{ type: 'clear_operations', scope }],
    };
  }

  // "add Y to (my note on) X" / "append Y to X" → update, never duplicate
  const append = t.match(/^(?:add|append|put)\s+(.+?)\s+(?:to|into|in)\s+(?:my\s+|the\s+)?(?:notes?\s+(?:on|about)?\s*)?(.+)$/i);
  if (append && ctx.nodeTitles.some((title) => fuzzyTitleHit(title, append[2]))) {
    return {
      reply: `Adding that to “${append[2].trim()}”, ${ctx.userName}.`,
      actions: [{ type: 'update_node', query: append[2].trim(), appendContent: `- ${capitalize(append[1].trim())}` }],
    };
  }

  // "open (my note on) X" → open it, don't recite it
  const open = lower.match(/^open\s+(?:my\s+|the\s+)?(?:notes?\s+(?:on|about)?\s*)?(.+)$/);
  if (open) {
    return {
      reply: `Opening “${open[1].trim()}”, ${ctx.userName}.`,
      actions: [{ type: 'open_node', query: open[1].trim() }],
    };
  }

  // "remind me to X" → task + reminder
  const remind = lower.match(/remind me (?:to|about)\s+(.+)/);
  if (remind) {
    const due = /tomorrow/.test(lower) ? tomorrow : today;
    return {
      reply: `Noted. I'll keep “${remind[1]}” on the board, ${ctx.userName}.`,
      actions: [
        { type: 'create_task', title: capitalize(remind[1]), priority: 'high', category: cat, due },
        { type: 'notify', kind: 'reminder', title: 'Reminder set', body: capitalize(remind[1]), priority: 1 },
      ],
    };
  }

  // "add a task ..." / "todo ..."
  const task = lower.match(/(?:add (?:a )?task|todo|i need to|task to)\s*[:-]?\s*(.+)/);
  if (task) {
    const due = /today/.test(lower) ? today : /tomorrow/.test(lower) ? tomorrow : undefined;
    return {
      reply: `Task logged, ${ctx.userName}.`,
      actions: [{ type: 'create_task', title: capitalize(task[1]), category: cat, priority: /urgent|critical|asap/.test(lower) ? 'critical' : 'normal', due }],
    };
  }

  // "replan / optimize my day"
  if (/(replan|optimi[sz]e|plan)\b.*\b(day|tomorrow|today)/.test(lower)) {
    const date = /tomorrow/.test(lower) ? tomorrow : today;
    return {
      reply: `Drafting a focused structure for ${date === today ? 'today' : 'tomorrow'}, ${ctx.userName} — protected blocks stay untouched.`,
      actions: [
        {
          type: 'plan_day',
          date,
          blocks: [
            { title: 'Deep work — top priority task', startMin: 9 * 60, durationMin: 90, category: 'business' },
            { title: 'Showroom rounds & ops', startMin: 11 * 60, durationMin: 90, category: 'business' },
            { title: 'Music production block', startMin: 14 * 60, durationMin: 120, category: 'music', protected: true },
            { title: 'Admin + correspondence batch', startMin: 17 * 60, durationMin: 45, category: 'personal' },
          ],
        },
      ],
    };
  }

  // "what have I been ignoring"
  if (/ignor|neglect|forgotten|stale/.test(lower)) {
    return {
      reply: `A fair question, ${ctx.userName}. Flagging the quietest corners of the system.`,
      actions: [
        { type: 'notify', kind: 'insight', title: 'Neglect scan', body: 'Check the Intelligence Feed — I surface stale high-importance nodes and overdue tasks there automatically.', priority: 1 },
      ],
    };
  }

  // Default: capture as a brain node with suggested links.
  const linkTo = ctx.nodeTitles
    .filter((title) => title.toLowerCase().split(/\s+/).some((w) => w.length > 4 && lower.includes(w.toLowerCase())))
    .slice(0, 3);
  return {
    reply: `Captured to the brain${linkTo.length ? ` and wired to ${linkTo.length} related node${linkTo.length > 1 ? 's' : ''}` : ''}, ${ctx.userName}.`,
    actions: [
      {
        type: 'create_node',
        title: t.length > 60 ? `${t.slice(0, 57)}…` : capitalize(t),
        content: `# ${capitalize(t)}\n\nCaptured by voice on ${format(new Date(), 'd MMM yyyy, HH:mm')}.\n\n> ${t}`,
        category: cat,
        nodeType: 'idea',
        tags: [cat],
        linkTo,
      },
    ],
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fuzzyTitleHit(title: string, query: string): boolean {
  const t = title.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return words.length > 0 && words.filter((w) => t.includes(w)).length >= Math.ceil(words.length / 2);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function analyzeCommand(transcript: string, ctx: AIContext): Promise<AIAnalysis> {
  const { provider, apiKey, model, baseUrl } = useSettingsStore.getState();
  if (!apiKey) return localAnalyze(transcript, ctx);
  const system = systemPrompt(ctx);
  const user = `Voice command: "${transcript}"`;
  try {
    return provider === 'anthropic'
      ? await callAnthropic(system, user, apiKey, model)
      : await callOpenAICompatible(system, user, apiKey, model, baseUrl);
  } catch (err) {
    console.warn('[JARVIS] LLM call failed, using local parser:', err);
    const fallback = localAnalyze(transcript, ctx);
    return { ...fallback, reply: `${fallback.reply} (Cloud intelligence unreachable — handled locally.)` };
  }
}

/** Free-form text generation for briefings. Returns null when no key configured. */
export async function generateText(system: string, user: string): Promise<string | null> {
  const { provider, apiKey, model, baseUrl } = useSettingsStore.getState();
  if (!apiKey) return null;
  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: 1024, system, messages: [{ role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json();
      const block = (data.content as { type: string; text?: string }[]).find((b) => b.type === 'text');
      return block?.text ?? null;
    }
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn('[JARVIS] generateText failed:', err);
    return null;
  }
}
