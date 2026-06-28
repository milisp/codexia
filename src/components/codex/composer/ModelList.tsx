import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

// Matches Rust FrontendModel
export type FrontendModel = {
  id: string;
  context_length?: number;
};

// Matches Rust FrontendProviderModels
export type FrontendProviderModels = {
  provider: string;
  models: FrontendModel[];
};

// Matches Rust EnvStatusItem
export type EnvStatusItem = {
  provider: string;
  env_key: string;
  is_env_set: boolean;
  api_key_url?: string;
  signup_url?: string;
};

export type ModelListItem = {
  id: string;
  label: string;
  description?: string;
};

type ModelListProps = {
  items: ModelListItem[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
};

export function ModelList({ items, selectedId, onSelect }: ModelListProps) {
  if (items.length === 0) {
    return (
      <div className="px-2 py-1 text-xs text-muted-foreground/70 italic">No models available</div>
    );
  }

  const topItems = items.slice(0, 3);
  const otherItems = items.slice(3);

  const renderItem = (item: ModelListItem) => (
    <div key={item.id} className="group relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className={cn(
          'flex-1 rounded-md border px-2 py-1 text-left transition-colors',
          selectedId === item.id
            ? 'border-primary bg-accent font-medium'
            : 'border-transparent hover:bg-accent/60',
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col gap-0.5 truncate">
              <span className="text-xs truncate">{item.label}</span>
            </div>
          </TooltipTrigger>
          {item.description && (
            <TooltipContent side="right">
              <p className="max-w-[200px] text-xs">{item.description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </button>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-0.5">
        {topItems.map(renderItem)}
        {otherItems.length > 0 && (
          <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="w-full rounded-md border border-transparent px-2 py-1 text-left text-xs text-muted-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                Other models...
              </button>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="start" className="w-64 p-2 shadow-md">
              <div className="max-h-60 space-y-0.5 overflow-y-auto">
                {otherItems.map(renderItem)}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </div>
    </TooltipProvider>
  );
}
