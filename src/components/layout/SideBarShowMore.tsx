import { Button } from '@/components/ui/button';

interface SideBarShowMoreProps {
  hiddenCount: number;
  expanded: boolean;
  onToggle: () => void;
}

/** Toggle under a truncated sidebar list; renders nothing when nothing is hidden. */
export function SideBarShowMore({ hiddenCount, expanded, onToggle }: SideBarShowMoreProps) {
  if (hiddenCount <= 0) return null;
  return (
    <Button
      variant="ghost"
      size="xs"
      className="justify-start px-1 text-muted-foreground"
      onClick={onToggle}
    >
      {expanded ? 'Show less' : 'Show more'}
    </Button>
  );
}
