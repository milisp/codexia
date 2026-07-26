import type { GitStatusEntry } from '@/services/tauri';

export type DiffSection = 'staged' | 'unstaged';
export type DiffSource = 'unstaged' | 'staged' | 'latest-turn';

export type TreeNode = TreeFolderNode | TreeFileNode;

export interface TreeFolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}

export interface TreeFileNode {
  type: 'file';
  name: string;
  path: string;
  entry: GitStatusEntry;
}

export interface GitDiffPanelProps {
  cwd: string | null;
  isActive: boolean;
}
