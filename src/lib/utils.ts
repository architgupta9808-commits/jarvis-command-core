import type { Category, TaskPriority } from '@/types';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function uid(prefix = 'n'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const CATEGORY_META: Record<Category, { label: string; color: string; dim: string }> = {
  business: { label: 'Business Ops', color: '#E6C37C', dim: 'rgba(230,195,124,0.14)' },
  music: { label: 'Music', color: '#B49AE8', dim: 'rgba(180,154,232,0.14)' },
  health: { label: 'Health', color: '#7FC9A2', dim: 'rgba(127,201,162,0.14)' },
  travel: { label: 'Travel', color: '#E2A85C', dim: 'rgba(226,168,92,0.14)' },
  family: { label: 'Family', color: '#E08FAE', dim: 'rgba(224,143,174,0.14)' },
  ideas: { label: 'Big Ideas', color: '#7FD8E5', dim: 'rgba(127,216,229,0.14)' },
  personal: { label: 'Personal', color: '#C8D8E8', dim: 'rgba(200,216,232,0.12)' },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; color: string; weight: number }> = {
  critical: { label: 'Critical', color: '#E5484D', weight: 0 },
  high: { label: 'High', color: '#E2A85C', weight: 1 },
  normal: { label: 'Normal', color: '#E6C37C', weight: 2 },
  low: { label: 'Low', color: '#9A8F78', weight: 3 },
};

export function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${ampm}` : `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Simple fuzzy-ish match: every token of the query must appear in the haystack. */
export function fuzzyMatch(haystack: string, query: string): boolean {
  const h = haystack.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => h.includes(t));
}

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}
