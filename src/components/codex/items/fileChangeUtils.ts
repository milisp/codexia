import { useLayoutStore } from '@/stores';

export const toRelativePath = (path: string, cwd: string | null) => {
  if (!cwd) return path;
  const prefix = cwd.endsWith('/') ? cwd : `${cwd}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
};

export const useOpenReviewTab = () => {
  const { setActiveRightPanelTab, setRightPanelOpen } = useLayoutStore();
  return () => {
    setActiveRightPanelTab('diff');
    setRightPanelOpen(true);
  };
};
