export function getFilename(path: string | undefined | null): string {
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop() ?? path;
}
