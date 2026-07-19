import type { BrainLink, BrainNode } from '@/types';
import { fuzzyMatch } from './utils';

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
const TAG_RE = /(^|\s)#([a-zA-Z][\w/-]*)/g;

/** Extract [[wikilink]] targets (raw titles) from markdown. */
export function extractWikilinks(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(WIKILINK_RE)) out.push(m[1].trim());
  return out;
}

/** Extract inline #tags from markdown. */
export function extractTags(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(TAG_RE)) out.add(m[2].toLowerCase());
  return [...out];
}

export function titleIndex(nodes: BrainNode[]): Map<string, BrainNode> {
  const idx = new Map<string, BrainNode>();
  for (const n of nodes) idx.set(n.title.toLowerCase(), n);
  return idx;
}

/** Build the full edge list: wikilinks parsed from content + manual links, deduped. */
export function buildLinks(nodes: BrainNode[], manual: BrainLink[]): BrainLink[] {
  const idx = titleIndex(nodes);
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set<string>();
  const links: BrainLink[] = [];

  const push = (source: string, target: string, kind: 'wiki' | 'manual') => {
    if (source === target || !ids.has(source) || !ids.has(target)) return;
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ source, target, kind });
  };

  for (const n of nodes) {
    for (const t of extractWikilinks(n.content)) {
      const hit = idx.get(t.toLowerCase());
      if (hit) push(n.id, hit.id, 'wiki');
    }
  }
  for (const l of manual) push(l.source, l.target, 'manual');
  return links;
}

export function neighborsOf(nodeId: string, links: BrainLink[]): Set<string> {
  const out = new Set<string>();
  for (const l of links) {
    if (l.source === nodeId) out.add(l.target);
    if (l.target === nodeId) out.add(l.source);
  }
  return out;
}

/** BFS out to `depth` hops from a set of seed node ids. */
export function subgraphIds(seeds: Set<string>, links: BrainLink[], depth = 1): Set<string> {
  const found = new Set(seeds);
  let frontier = new Set(seeds);
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const l of links) {
      if (frontier.has(l.source) && !found.has(l.target)) next.add(l.target);
      if (frontier.has(l.target) && !found.has(l.source)) next.add(l.source);
    }
    next.forEach((id) => found.add(id));
    frontier = next;
    if (next.size === 0) break;
  }
  return found;
}

/** Nodes whose title/tags/content match the query. */
export function searchNodes(nodes: BrainNode[], query: string): BrainNode[] {
  const q = query.trim();
  if (!q) return nodes;
  return nodes.filter((n) => fuzzyMatch(`${n.title} ${n.tags.join(' ')} ${n.content}`, q));
}

/** Given free text, suggest existing nodes worth linking (shared words/tags). */
export function suggestLinks(nodes: BrainNode[], text: string, exceptId?: string, limit = 5): BrainNode[] {
  const words = new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
  );
  const scored = nodes
    .filter((n) => n.id !== exceptId)
    .map((n) => {
      let score = 0;
      const title = n.title.toLowerCase();
      for (const w of words) {
        if (title.includes(w)) score += 3;
        if (n.tags.some((t) => t.includes(w))) score += 2;
      }
      if (score === 0 && [...words].some((w) => n.content.toLowerCase().includes(` ${w} `))) score = 1;
      return { n, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.n);
}

/** Best single node match for a natural-language query (used by voice commands). */
export function bestMatch(nodes: BrainNode[], query: string): BrainNode | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const exact = nodes.find((n) => n.title.toLowerCase() === q);
  if (exact) return exact;
  const results = searchNodes(nodes, q);
  if (results.length > 0) {
    // Prefer title matches, then importance.
    return [...results].sort((a, b) => {
      const at = fuzzyMatch(a.title, q) ? 0 : 1;
      const bt = fuzzyMatch(b.title, q) ? 0 : 1;
      return at - bt || b.importance - a.importance;
    })[0];
  }
  return undefined;
}
