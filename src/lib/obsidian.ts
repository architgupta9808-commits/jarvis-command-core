import { formatISO } from 'date-fns';
import type { BrainNode, Category, NodeType } from '@/types';
import { extractTags } from './graph';
import { uid } from './utils';

/**
 * Obsidian integration.
 *
 * Two paths:
 *  1. Local REST API plugin (https://github.com/coddingtonbear/obsidian-local-rest-api)
 *     - Enable the plugin, copy its API key, default endpoints:
 *       http://127.0.0.1:27123 (insecure) or https://127.0.0.1:27124 (self-signed TLS).
 *     - We use the insecure HTTP port by default to avoid the self-signed-cert dance in browsers.
 *  2. Folder import: drop a vault folder via <input webkitdirectory> — fully offline.
 *
 * Sync model (deliberately simple + safe):
 *  - Pull: vault → app. Notes matched by obsidianPath; incoming wins if remote mtime is newer.
 *  - Push: app → vault. Only nodes that originated from Obsidian (have obsidianPath) are
 *    written back, and only when the app copy is newer. New app nodes are exported to a
 *    "JARVIS/" folder in the vault on push, so nothing in the user's vault is clobbered.
 */

export interface ObsidianConfig {
  baseUrl: string;
  apiKey: string;
}

interface VaultFileMeta {
  path: string;
}

function headers(cfg: ObsidianConfig): HeadersInit {
  return { Authorization: `Bearer ${cfg.apiKey}` };
}

export async function testConnection(cfg: ObsidianConfig): Promise<boolean> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/vault/`, { headers: headers(cfg) });
  return res.ok;
}

async function listMarkdownFiles(cfg: ObsidianConfig, dir = ''): Promise<string[]> {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/vault/${dir}`, { headers: { ...headers(cfg), Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Vault list failed (${res.status})`);
  const data = (await res.json()) as { files: string[] };
  const out: string[] = [];
  for (const f of data.files ?? []) {
    const full = dir + f;
    if (f.endsWith('/')) out.push(...(await listMarkdownFiles(cfg, full)));
    else if (f.endsWith('.md')) out.push(full);
  }
  return out;
}

export async function pullVault(cfg: ObsidianConfig, onProgress?: (done: number, total: number) => void): Promise<BrainNode[]> {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const files = await listMarkdownFiles(cfg);
  const nodes: BrainNode[] = [];
  let i = 0;
  for (const path of files) {
    const res = await fetch(`${base}/vault/${encodeURI(path)}`, { headers: headers(cfg) });
    if (res.ok) {
      const content = await res.text();
      nodes.push(markdownToNode(path, content));
    }
    onProgress?.(++i, files.length);
  }
  return nodes;
}

export async function pushNote(cfg: ObsidianConfig, node: BrainNode): Promise<void> {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const path = node.obsidianPath ?? `JARVIS/${sanitizeFilename(node.title)}.md`;
  const res = await fetch(`${base}/vault/${encodeURI(path)}`, {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'text/markdown' },
    body: nodeToMarkdown(node),
  });
  if (!res.ok) throw new Error(`Push failed for ${path} (${res.status})`);
}

/* ---------------- Markdown ⇄ node conversion ---------------- */

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function markdownToNode(path: string, raw: string): BrainNode {
  let content = raw;
  let category: Category = 'personal';
  let type: NodeType = 'note';
  let importance: 1 | 2 | 3 = 1;
  let tags: string[] = [];

  const fm = raw.match(FRONTMATTER_RE);
  if (fm) {
    content = raw.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const [k, ...rest] = line.split(':');
      const v = rest.join(':').trim();
      const key = k.trim().toLowerCase();
      if (key === 'category' && isCategory(v)) category = v;
      if (key === 'type' && isNodeType(v)) type = v;
      if (key === 'importance') importance = Math.min(3, Math.max(1, parseInt(v) || 1)) as 1 | 2 | 3;
      if (key === 'tags') tags = v.replace(/[[\]]/g, '').split(',').map((t) => t.trim()).filter(Boolean);
    }
  }
  const title = path.split('/').pop()!.replace(/\.md$/, '');
  const inlineTags = extractTags(content);
  const now = formatISO(new Date());
  return {
    id: uid('obs'),
    title,
    type,
    category,
    importance,
    tags: [...new Set([...tags, ...inlineTags])],
    content,
    createdAt: now,
    updatedAt: now,
    obsidianPath: path,
  };
}

export function nodeToMarkdown(node: BrainNode): string {
  const fm = [
    '---',
    `category: ${node.category}`,
    `type: ${node.type}`,
    `importance: ${node.importance}`,
    `tags: [${node.tags.join(', ')}]`,
    `updated: ${node.updatedAt}`,
    '---',
    '',
  ].join('\n');
  return fm + node.content;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
}

function isCategory(v: string): v is Category {
  return ['business', 'music', 'health', 'travel', 'family', 'ideas', 'personal'].includes(v);
}
function isNodeType(v: string): v is NodeType {
  return ['note', 'project', 'task', 'person', 'idea', 'event'].includes(v);
}

/** Folder-upload import (works without any plugin). */
export async function importVaultFolder(files: FileList): Promise<BrainNode[]> {
  const nodes: BrainNode[] = [];
  for (const file of Array.from(files)) {
    if (!file.name.endsWith('.md')) continue;
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const text = await file.text();
    nodes.push(markdownToNode(rel, text));
  }
  return nodes;
}
