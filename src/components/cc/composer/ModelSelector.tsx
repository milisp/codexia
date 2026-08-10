import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { EffortSlider } from '@/components/common/EffortSlider';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCCStore } from '@/stores';
import { CC_EFFORT_LEVELS, type EffortLevel, type ModelType } from '@/stores/cc';

const MODELS: { id: ModelType; label: string }[] = [
  { id: 'fable', label: 'Fable' },
  { id: 'opus', label: 'Opus' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'haiku', label: 'Haiku' },
];

export function ModelSelector() {
  const { options, updateOptions } = useCCStore();
  const [open, setOpen] = useState(false);
  const model = options.model ?? 'sonnet';
  const effort = options.effort ?? 'medium';
  const activeLabel = MODELS.find((m) => m.id === model)?.label ?? model;

  const handleModelChange = (value: ModelType) => {
    updateOptions({ model: value });
    setOpen(false);
  };

  const handleEffortChange = (value: EffortLevel) => {
    updateOptions({ effort: value });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 border border-transparent transition-all hover:border-input hover:bg-accent/50"
        >
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <span className="font-medium">{activeLabel}</span>
            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono capitalize text-muted-foreground border">
              {effort}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="end">
        {/* No input: the Command root itself takes focus so arrow keys / Enter work. */}
        <Command loop tabIndex={0} className="outline-none">
          <CommandList>
            <CommandGroup>
              {MODELS.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => handleModelChange(item.id)}
                >
                  <span className="flex-1">{item.label}</span>
                  {model === item.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <EffortSlider
          label="Effort"
          options={CC_EFFORT_LEVELS}
          value={effort}
          onChange={handleEffortChange}
        />
      </PopoverContent>
    </Popover>
  );
}
