import JSZip from 'jszip';
import { format } from 'date-fns';
import type { BrainLink, BrainNode, CalendarEvent, Task } from '@/types';
import { nodeToMarkdown, sanitizeFilename } from './obsidian';

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  nodes: BrainNode[];
  manualLinks: BrainLink[];
  tasks: Task[];
  events: CalendarEvent[];
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(bundle: Omit<ExportBundle, 'version' | 'exportedAt'>) {
  const data: ExportBundle = { version: 1, exportedAt: new Date().toISOString(), ...bundle };
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `jarvis-core-${format(new Date(), 'yyyyMMdd-HHmm')}.json`
  );
}

export async function exportMarkdownZip(nodes: BrainNode[]) {
  const zip = new JSZip();
  for (const n of nodes) {
    const path = n.obsidianPath ?? `${n.category}/${sanitizeFilename(n.title)}.md`;
    zip.file(path, nodeToMarkdown(n));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  download(blob, `jarvis-brain-${format(new Date(), 'yyyyMMdd-HHmm')}.zip`);
}

export async function parseImportedJSON(file: File): Promise<ExportBundle> {
  const data = JSON.parse(await file.text());
  if (!data || !Array.isArray(data.nodes)) throw new Error('Not a JARVIS export file.');
  return data as ExportBundle;
}
