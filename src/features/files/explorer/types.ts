export type FileNode = {
  name: string;
  path: string;
  kind: 'file' | 'dir' | 'symlink';
  children?: FileNode[];
};

export type FileTreeProps = {
  folder: string;
  onFileSelect?: (path: string) => void;
};
