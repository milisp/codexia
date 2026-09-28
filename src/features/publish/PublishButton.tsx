import { Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { detectPublishDefaults, type PublishDefaults } from './detectPublishDefaults';
import { PublishDialog } from './PublishDialog';
import { usePublishStore } from './usePublishStore';

export function PublishButton() {
  const { cwd } = useWorkspaceStore();
  const hasPublished = usePublishStore((state) => (cwd ? !!state.lastPublish[cwd] : false));
  const [defaults, setDefaults] = useState<PublishDefaults | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDefaults(null);
    if (!cwd) return;
    void detectPublishDefaults(cwd).then((detected) => {
      if (!cancelled) setDefaults(detected);
    });
    return () => {
      cancelled = true;
    };
  }, [cwd]);

  if (!cwd || !defaults) return null;

  // A game project that was never published gets the loud version of the button.
  const highlight = defaults.looksLikeGame && !hasPublished;

  return (
    <>
      <Button
        size="sm"
        variant={highlight ? 'default' : 'ghost'}
        className={cn(
          'relative h-7 gap-1 px-2',
          highlight && 'bg-orange-500 text-white hover:bg-orange-600'
        )}
        onClick={() => setOpen(true)}
        title="Publish to productship.lol — get a shareable game link"
      >
        <Rocket className="size-3.5" />
        Publish
        {highlight && (
          <span className="absolute -right-0.5 -top-0.5 flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-300 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-orange-300" />
          </span>
        )}
      </Button>
      <PublishDialog open={open} onOpenChange={setOpen} cwd={cwd} defaults={defaults} />
    </>
  );
}
