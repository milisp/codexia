import { useMemo } from 'react';
type ThreadListLike = {
  preview: string;
};

export function useThreadFilter<T extends ThreadListLike>(threads: T[], searchTerm: string) {
  return useMemo(() => {
    if (!searchTerm) return threads;
    const normalized = searchTerm.toLowerCase();
    return threads.filter((thread) => thread.preview.toLowerCase().includes(normalized));
  }, [threads, searchTerm]);
}
