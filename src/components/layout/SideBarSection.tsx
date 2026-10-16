import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SideBarSectionProps {
  /** Leading glyph; rendered in a fixed 16px slot so every section lines up. */
  icon: ReactNode;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title click action; without it the title toggles the section. */
  onTitleClick?: () => void;
  /** Trailing buttons, e.g. "new". */
  actions?: ReactNode;
  children: ReactNode;
}

/** A collapsible sidebar section whose header aligns with the nav buttons above it. */
export function SideBarSection({
  icon,
  title,
  open,
  onOpenChange,
  onTitleClick,
  actions,
  children,
}: SideBarSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="group/section flex items-center gap-0.5 pr-1">
        <Button
          variant="ghost"
          size="sm"
          className="min-w-0 shrink justify-start gap-2 border border-transparent px-2.5"
          onClick={onTitleClick ?? (() => onOpenChange(!open))}
        >
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
          >
            {icon}
          </span>
          <span className="truncate">{title}</span>
        </Button>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            // Hover-only, like the project rows, to keep the header quiet.
            className="opacity-0 transition-opacity group-hover/section:opacity-100 focus-visible:opacity-100"
            aria-label={`${open ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`}
          >
            <ChevronRight
              className={`size-3.5 text-muted-foreground/60 transition-transform ${open ? 'rotate-90' : ''}`}
            />
          </Button>
        </CollapsibleTrigger>
        <div className="flex-1" />
        {actions}
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
