import { format, formatISO, isBefore, parseISO, subDays } from 'date-fns';
import type { BrainNode, BriefingData, CalendarEvent, FeedItem, Task } from '@/types';
import { generateText } from './ai';
import { minToLabel, PRIORITY_META, uid } from './utils';

function timeGreeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name}.`;
}

interface BriefingInput {
  tasks: Task[];
  events: CalendarEvent[];
  nodes: BrainNode[];
  userName: string;
}

/** Deterministic local briefing — always available, in character. */
export function localBriefing({ tasks, events, nodes, userName }: BriefingInput): BriefingData {
  const today = format(new Date(), 'yyyy-MM-dd');
  const open = tasks.filter((t) => !t.done);
  const dueToday = open.filter((t) => t.due === today);
  const overdue = open.filter((t) => t.due && t.due < today);
  const highLeverage = open.filter((t) => t.priority === 'critical' || t.priority === 'high');
  const todayEvents = [...events.filter((e) => e.date === today)].sort((a, b) => a.startMin - b.startMin);
  const protectedBlock = todayEvents.find((e) => e.protected && e.category === 'music');
  const stale = nodes
    .filter((n) => n.importance >= 2 && isBefore(parseISO(n.updatedAt), subDays(new Date(), 21)))
    .slice(0, 2);

  const lines: string[] = [];
  lines.push(
    `**${highLeverage.length} high-leverage task${highLeverage.length === 1 ? '' : 's'}** on the board` +
      (dueToday.length ? `, ${dueToday.length} due today` : '') +
      (overdue.length ? `, ${overdue.length} overdue — worth clearing first` : '') +
      '.'
  );
  if (todayEvents.length) {
    const first = todayEvents[0];
    lines.push(`Day opens with **${first.title}** at ${minToLabel(first.startMin)} — ${todayEvents.length} block${todayEvents.length === 1 ? '' : 's'} scheduled in total.`);
  } else {
    lines.push('The calendar is open — an uncommitted day is either a gift or a warning, Sir.');
  }
  if (protectedBlock) {
    lines.push(`Your protected **${protectedBlock.title.toLowerCase()}** starts at ${minToLabel(protectedBlock.startMin)}. I will defend it.`);
  }
  if (overdue.length) {
    lines.push(`Slipping: ${overdue.slice(0, 3).map((t) => `*${t.title}*`).join(', ')}.`);
  }
  if (stale.length) {
    lines.push(`Quiet lately: ${stale.map((n) => `*${n.title}*`).join(' and ')} — untouched for three weeks or more.`);
  }
  return { greeting: timeGreeting(userName), body: lines.join('\n\n'), generatedAt: formatISO(new Date()), source: 'local' };
}

/** LLM briefing when a key is configured; falls back to local otherwise. */
export async function generateBriefing(input: BriefingInput): Promise<BriefingData> {
  const local = localBriefing(input);
  const today = format(new Date(), 'yyyy-MM-dd');
  const open = input.tasks.filter((t) => !t.done);
  const system = `You are JARVIS: calm, precise, subtly witty chief-of-staff. Write a daily briefing in markdown, 3–5 short paragraphs or bullets, addressing the user as "${input.userName}". Be specific and prioritised, never generic. No headers, no sign-off.`;
  const user = `Date: ${format(new Date(), 'EEEE d MMM yyyy')}
Open tasks: ${open.map((t) => `${t.title} [${t.priority}${t.due ? `, due ${t.due}` : ''}]`).join('; ')}
Today's events: ${input.events.filter((e) => e.date === today).map((e) => `${e.title} @${minToLabel(e.startMin)} (${e.durationMin}m)${e.protected ? ' [protected]' : ''}`).join('; ') || 'none'}
Recently touched brain areas: ${[...input.nodes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map((n) => n.title).join(', ')}
Write the briefing.`;
  const text = await generateText(system, user);
  if (!text) return local;
  return { greeting: timeGreeting(input.userName), body: text.trim(), generatedAt: formatISO(new Date()), source: 'ai' };
}

/** Derive Intelligence Feed items from current state (conflicts, overdue, stale, unlinked). */
export function deriveFeed(input: BriefingInput): FeedItem[] {
  const items: FeedItem[] = [];
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = formatISO(new Date());
  const open = input.tasks.filter((t) => !t.done);

  // Calendar conflicts
  const todays = [...input.events.filter((e) => e.date >= today)].sort((a, b) => (a.date + a.startMin).toString().localeCompare((b.date + b.startMin).toString()));
  for (let i = 0; i < todays.length - 1; i++) {
    const a = todays[i];
    const b = todays[i + 1];
    if (a.date === b.date && b.startMin < a.startMin + a.durationMin) {
      items.push({
        id: uid('feed'), kind: 'conflict', priority: 0, ts: now,
        title: 'Schedule collision',
        body: `“${a.title}” overlaps “${b.title}” on ${a.date === today ? 'today' : a.date}. One of them has to move, Sir.`,
      });
    }
  }
  // Overdue tasks
  for (const t of open.filter((t) => t.due && t.due < today).slice(0, 3)) {
    items.push({
      id: uid('feed'), kind: 'alert', priority: 0, ts: now,
      title: `Overdue: ${t.title}`,
      body: `Due ${t.due}, priority ${PRIORITY_META[t.priority].label.toLowerCase()}. Recommend clearing or consciously dropping it.`,
    });
  }
  // Due today
  for (const t of open.filter((t) => t.due === today).slice(0, 4)) {
    items.push({
      id: uid('feed'), kind: 'reminder', priority: 1, ts: now,
      title: `Due today: ${t.title}`,
      body: `${PRIORITY_META[t.priority].label} priority${t.linkedNodeId ? ' · linked to a brain node' : ''}.`,
      linkedNodeId: t.linkedNodeId,
    });
  }
  // Stale important nodes ("what have I been ignoring")
  const stale = input.nodes
    .filter((n) => n.importance >= 2 && isBefore(parseISO(n.updatedAt), subDays(new Date(), 21)))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, 3);
  for (const n of stale) {
    items.push({
      id: uid('feed'), kind: 'insight', priority: 2, ts: now,
      title: `Going quiet: ${n.title}`,
      body: `High-importance node untouched since ${format(parseISO(n.updatedAt), 'd MMM')}. Worth a deliberate look — or a deliberate archive.`,
      linkedNodeId: n.id,
    });
  }
  // Opportunity: unscheduled high-priority tasks
  const unscheduled = open.filter((t) => (t.priority === 'critical' || t.priority === 'high') && !t.scheduled);
  if (unscheduled.length >= 2) {
    items.push({
      id: uid('feed'), kind: 'opportunity', priority: 2, ts: now,
      title: 'Unscheduled firepower',
      body: `${unscheduled.length} high-priority tasks have no time block. Drag them onto the timeline — intentions without hours rarely survive the day.`,
    });
  }
  return items.sort((a, b) => a.priority - b.priority);
}
