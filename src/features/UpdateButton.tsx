import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDesktopTauri } from '@/hooks/runtime';
import { useUpdater } from '@/hooks/useUpdater';

export function UpdateButton() {
  const { hasUpdate, startUpdate } = useUpdater({ enabled: !import.meta.env.DEV });

  if (!isDesktopTauri()) {
    return null;
  }

  if (import.meta.env.DEV) {
    return null;
  }

  if (!hasUpdate) {
    return null;
  }

  return (
    <Button size="icon-sm" onClick={() => void startUpdate()}>
      <Download className="h-4 w-4" />
    </Button>
  );
}
