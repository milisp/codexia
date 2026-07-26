import type { TauriFileEntry } from '@/services/tauri';
import type { FileNode } from './types';

export const getExtension = (name: string): string => {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
};

export const sortNodes = (nodes: FileNode[]): FileNode[] =>
  nodes.slice().sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

export const normalizeName = (name: string): string => name.replace(/^\.+/, '').toLowerCase();

export const shouldSkipEntry = (name: string, hiddenSet: Set<string>): boolean =>
  name === '.git' || hiddenSet.has(normalizeName(name));

export const isLatexFile = (ext: string): boolean => ['tex', 'latex', 'ltx'].includes(ext);

export const isPdfFile = (ext: string): boolean => ext === 'pdf';

export const isOfficeFile = (ext: string): boolean => ['docx', 'xlsx', 'xls', 'pptx'].includes(ext);

export const buildSearchTree = (rootNode: FileNode, matches: TauriFileEntry[]): FileNode => {
  const pathSeparator = rootNode.path.includes('\\') ? '\\' : '/';
  const treeRoot: FileNode = {
    name: rootNode.name,
    path: rootNode.path,
    kind: 'dir',
    children: [],
  };
  const nodeMap = new Map<string, FileNode>([[treeRoot.path, treeRoot]]);

  for (const match of matches) {
    if (!match.path.startsWith(rootNode.path)) continue;

    const relativePath = match.path.slice(rootNode.path.length).replace(/^[/\\]/, '');
    if (!relativePath) continue;

    const segments = relativePath.split(/[/\\]+/).filter(Boolean);
    if (segments.length === 0) continue;

    let currentPath = rootNode.path;
    let parent = treeRoot;

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const isLeaf = i === segments.length - 1;
      currentPath = `${currentPath}${currentPath.endsWith(pathSeparator) ? '' : pathSeparator}${segment}`;

      const existingNode = nodeMap.get(currentPath);
      if (existingNode) {
        parent = existingNode;
        continue;
      }

      const childNode: FileNode = {
        name: segment,
        path: isLeaf ? match.path : currentPath,
        kind: isLeaf ? (match.is_dir ? 'dir' : 'file') : 'dir',
        children: isLeaf && !match.is_dir ? undefined : [],
      };

      if (!parent.children) parent.children = [];
      parent.children.push(childNode);
      nodeMap.set(currentPath, childNode);
      parent = childNode;
    }
  }

  const sortTree = (node: FileNode): FileNode => {
    if (!node.children) return node;
    return { ...node, children: sortNodes(node.children).map(sortTree) };
  };

  return sortTree(treeRoot);
};
