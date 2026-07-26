import type { GitStatusEntry } from '@/services/tauri';
import type { DiffSection, TreeFileNode, TreeFolderNode, TreeNode } from './types';

interface MutableFolderNode {
  name: string;
  path: string;
  folders: Map<string, MutableFolderNode>;
  files: TreeFileNode[];
}

export const LARGE_DIFF_THRESHOLD_BYTES = 512 * 1024;

export function statusTextForSection(entry: GitStatusEntry, section: DiffSection): string {
  if (entry.index_status === '?' && entry.worktree_status === '?') {
    return '??';
  }
  return section === 'staged'
    ? entry.index_status.trim() || ' '
    : entry.worktree_status.trim() || ' ';
}

export function statusColorByText(text: string): string {
  if (text === '??') return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30';
  if (text.includes('U')) return 'bg-rose-500/10 text-rose-500 border-rose-500/30';
  if (text.includes('R')) return 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/30';
  if (text.includes('C')) return 'bg-sky-500/10 text-sky-500 border-sky-500/30';
  if (text.includes('T')) return 'bg-violet-500/10 text-violet-500 border-violet-500/30';
  if (text.includes('D')) return 'bg-red-500/10 text-red-500 border-red-500/30';
  if (text.includes('A')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
  if (text.includes('M')) return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildFileTree(entries: GitStatusEntry[]): TreeNode[] {
  const root: MutableFolderNode = {
    name: '',
    path: '',
    folders: new Map(),
    files: [],
  };

  for (const entry of entries) {
    const parts = entry.path.split('/').filter(Boolean);
    let cursor = root;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const isLast = index === parts.length - 1;
      if (isLast) {
        cursor.files.push({
          type: 'file',
          name: part,
          path: entry.path,
          entry,
        });
      } else {
        const nextPath = cursor.path ? `${cursor.path}/${part}` : part;
        const existing = cursor.folders.get(part);
        if (existing) {
          cursor = existing;
        } else {
          const created: MutableFolderNode = {
            name: part,
            path: nextPath,
            folders: new Map(),
            files: [],
          };
          cursor.folders.set(part, created);
          cursor = created;
        }
      }
    }
  }

  const toTreeNodes = (folder: MutableFolderNode): TreeNode[] => {
    const folderNodes: TreeFolderNode[] = [...folder.folders.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        type: 'folder',
        name: item.name,
        path: item.path,
        children: toTreeNodes(item),
      }));
    const fileNodes = [...folder.files].sort((a, b) => a.name.localeCompare(b.name));
    return [...folderNodes, ...fileNodes];
  };

  return toTreeNodes(root);
}
