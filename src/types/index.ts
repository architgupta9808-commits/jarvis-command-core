/** Core domain types for JARVIS Command Core. */

export type NodeType = 'note' | 'project' | 'task' | 'person' | 'idea' | 'event';

export type Category =
  | 'business'
  | 'music'
  | 'health'
  | 'travel'
  | 'family'
  | 'ideas'
  | 'personal';

export interface BrainNode {
  id: string;
  title: string;
  type: NodeType;
  category: Category;
  tags: string[];
  /** Markdown body. [[Wikilinks]] are parsed into graph edges. */
  content: string;
  importance: 1 | 2 | 3;
  pinned?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Obsidian vault-relative path when synced/imported. */
  obsidianPath?: string;
}

export interface BrainLink {
  source: string;
  target: string;
  kind: 'wiki' | 'manual';
}

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
  category: Category;
  /** ISO date (yyyy-MM-dd) the task is due. */
  due?: string;
  /** When placed on the timeline. */
  scheduled?: { date: string; startMin: number; durationMin: number };
  linkedNodeId?: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  startMin: number; // minutes from midnight
  durationMin: number;
  category: Category;
  linkedNodeId?: string;
  protected?: boolean; // focus blocks JARVIS defends when replanning
}

/* ---------- Notes (The Shelf) ---------- */

export type NoteFormat = 'note' | 'todo' | 'reminder' | 'commitment';

export interface NoteItem {
  text: string;
  done: boolean;
}

export interface BrainNote {
  id: string;
  title: string;
  body: string;
  format: NoteFormat;
  category: Category;
  /** Checklist rows when format === 'todo'. */
  items?: NoteItem[];
  /** ISO-ish "yyyy-MM-dd HH:mm" when format === 'reminder'. */
  remindAt?: string;
  /** The graph node this note was committed into. */
  nodeId?: string;
  createdAt: string;
}

export type FeedKind = 'reminder' | 'conflict' | 'opportunity' | 'insight' | 'alert';

export interface FeedItem {
  id: string;
  kind: FeedKind;
  title: string;
  body: string;
  priority: number; // 0 (highest) .. 3
  ts: string;
  dismissed?: boolean;
  linkedNodeId?: string;
}

/* ---------- Voice / AI ---------- */

export type AIAction =
  | { type: 'create_node'; title: string; content?: string; category?: Category; nodeType?: NodeType; tags?: string[]; linkTo?: string[] }
  | { type: 'update_node'; query: string; appendContent?: string; addTags?: string[]; linkTo?: string[] }
  | { type: 'create_task'; title: string; priority?: TaskPriority; category?: Category; due?: string; linkTo?: string }
  | { type: 'complete_task'; query: string }
  | { type: 'create_event'; title: string; date: string; startMin: number; durationMin: number; category?: Category; protected?: boolean }
  | { type: 'focus_graph'; query: string }
  | { type: 'open_node'; query: string }
  | { type: 'switch_view'; view: 'godseye' | 'operations' | 'notes' }
  | { type: 'plan_day'; date: string; blocks: { title: string; startMin: number; durationMin: number; category?: Category; protected?: boolean }[] }
  | { type: 'notify'; kind: FeedKind; title: string; body: string; priority?: number }
  | { type: 'clear_operations'; scope: 'tasks' | 'events' | 'all' };

export interface AIAnalysis {
  /** JARVIS' short spoken-style reply. */
  reply: string;
  actions: AIAction[];
}

export interface BriefingData {
  greeting: string;
  body: string; // markdown
  generatedAt: string;
  source: 'ai' | 'local';
}

/* ---------- Live feeds (published by the PC data engine into the sync gist) ---------- */

export interface GmailDigest {
  generatedAt: string;
  today: { total: number; urgent: { from: string; subject: string }[] };
  week: { total: number; urgentCount: number; categories: Record<string, number> };
  subscriptions: { mailCount7d: number; active: { name: string; note?: string }[] };
}

/* ---------- Settings ---------- */

export type LLMProvider = 'anthropic' | 'openai-compatible';

export interface PhysicsSettings {
  chargeStrength: number; // negative = repulsion
  linkDistance: number;
  velocityDecay: number;
  particleSpeed: number;
}

export interface ObsidianSettings {
  baseUrl: string; // e.g. http://127.0.0.1:27123
  apiKey: string;
  connected: boolean;
  lastSync?: string;
}
