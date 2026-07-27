import { Blocks, Package2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MCP } from '@/components/icons';

export function TabSwitcher<T extends string>({
  tabs,
  active,
  onChange,
  showLabel = true,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  showLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
      {tabs.map((t) => (
        <Button
          key={t}
          variant="ghost"
          size="sm"
          onClick={() => onChange(t)}
          className={`h-7 ${active === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          {t.startsWith('MCP') ? (
            <MCP className="h-3.5 w-3.5" />
          ) : t === 'Tools' ? (
            <Blocks className="h-4 w-4" />
          ) : (
            <Package2 className="h-4 w-4" />
          )}
          {showLabel && ` ${t}`}
        </Button>
      ))}
    </div>
  );
}
