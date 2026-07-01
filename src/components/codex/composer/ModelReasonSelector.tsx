import { ChevronsUpDown, Settings, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReasoningEffort } from '@/bindings';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useConfigStore, useCodexStore } from '@/components/codex/stores';
import { codexService } from '@/services/codexService';
import type { Provider } from '@/stores/settings';
import { ModelList } from './ModelList';
import { useModels } from '../hooks/useModels';
import { Input } from '@/components/ui/input';
import { EnvKeysDialog } from './EnvKeysDialog';
import { ProviderIcons } from '@/components/icons';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useComposerToolbarNarrow } from './ComposerToolbarContext';

const GENERIC_REASONING_OPTIONS: ReasoningEffort[] = ['none', 'low', 'medium', 'high', 'xhigh'];

type BaseModelSelectorProps = {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  value: string | undefined;
  onValueChange: (id: string) => void;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (value: ReasoningEffort) => void;
  disabled?: boolean;
  onClose?: () => void;
};

function BaseModelSelector({
  provider,
  onProviderChange,
  value,
  onValueChange,
  reasoningEffort,
  onReasoningEffortChange,
  disabled = false,
  onClose,
}: BaseModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [envKeysOpen, setEnvKeysOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { openAiModels, providerItems, allProviders } = useModels();
  const isNarrow = useComposerToolbarNarrow();

  const handleSelect = useCallback(
    (targetProvider: string, id: string) => {
      if (targetProvider !== provider) {
        onProviderChange(targetProvider as Provider);
      }
      onValueChange(id);

      if (targetProvider === 'openai') {
        const selected = openAiModels.find((m) => m.id === id);
        if (selected && onReasoningEffortChange) {
          onReasoningEffortChange(selected.defaultReasoningEffort);
        }
      } else if (onReasoningEffortChange && (!reasoningEffort || !GENERIC_REASONING_OPTIONS.includes(reasoningEffort))) {
        onReasoningEffortChange('medium');
      }

      setOpen(false);
      onClose?.();
    },
    [onValueChange, onProviderChange, provider, openAiModels, onReasoningEffortChange, reasoningEffort],
  );

  const currentItems = providerItems(provider);
  const activeItem = currentItems.find((m) => m.id === value);
  const activeLabel = activeItem?.label || value || 'Select model';

  const selectedOpenAiModel = provider === 'openai' ? openAiModels.find((m) => m.id === value) : undefined;

  const availableOptions = useMemo(() => {
    if (provider === 'openai') {
      return selectedOpenAiModel?.supportedReasoningEfforts.map(o => o.reasoningEffort) ?? [];
    }
    return GENERIC_REASONING_OPTIONS;
  }, [provider, selectedOpenAiModel]);

  const canSelectReasoning = !disabled && !!value && availableOptions.length > 0;

  const filteredProvidersWithItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return allProviders
      .map((p) => {
        const items = providerItems(p);
        const filteredItems = items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.id.toLowerCase().includes(query)
        );
        return { provider: p, items: filteredItems };
      })
      .filter((p) => p.items.length > 0 || p.provider.toLowerCase().includes(query));
  }, [allProviders, providerItems, searchQuery]);

  return (
    <div className="flex items-center">
      <Popover open={open} onOpenChange={(io) => { setOpen(io); if (!io) setSearchQuery(''); }}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 border border-transparent transition-all hover:border-input hover:bg-accent/50"
            disabled={disabled}
          >
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              {provider !== 'openai' && !isNarrow && <span className="font-semibold tracking-wider text-muted-foreground">{provider}</span>}
              <span className="font-medium max-w-[120px] truncate">{activeLabel}</span>
              {reasoningEffort !== undefined && reasoningEffort !== 'none' && (
                <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono capitalize text-muted-foreground border">
                  {reasoningEffort}
                </span>
              )}
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-2 flex flex-col gap-3" align="start">
          <PopoverTitle className="flex items-center gap-2 pb-2 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search provider or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 pl-7 text-xs focus-visible:ring-1"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEnvKeysOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTitle>

          <div className="max-h-56 space-y-3 overflow-y-auto pr-1 subtle-scrollbar">
            {filteredProvidersWithItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No results found</p>
            ) : (
              filteredProvidersWithItems.map(({ provider: p, items }) => (
                <div key={p} className="space-y-1">
                  <Label className="text-[10px] font-bold text-muted-foreground/70 tracking-wider flex items-center gap-1.5 px-2 py-0.5">
                    <ProviderIcons providerId={p} size="sm" />
                    {p}
                  </Label>
                  <ModelList
                    items={items}
                    selectedId={p === provider ? value : undefined}
                    onSelect={(id) => handleSelect(p, id)}
                  />
                </div>
              ))
            )}
          </div>

          {reasoningEffort !== undefined && onReasoningEffortChange && (
            <div className={cn("pt-2 border-t space-y-1.5", !canSelectReasoning && "opacity-40 pointer-events-none")}>
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-muted-foreground/70 tracking-wider">
                  Reasoning Effort
                </span>
                <span className="text-xs font-semibold text-primary capitalize">
                  {reasoningEffort}
                </span>
              </div>

              <TooltipProvider delayDuration={200}>
                <div className="flex w-full gap-0.5 bg-muted p-0.5 rounded-md border border-input/50">
                  {availableOptions.map((option) => {
                    const isSelected = reasoningEffort === option;
                    const openAiOpt = selectedOpenAiModel?.supportedReasoningEfforts.find(o => o.reasoningEffort === option);
                    const description = provider === 'openai' ? openAiOpt?.description : undefined;

                    const buttonContent = (
                      <button
                        key={option}
                        type="button"
                        disabled={!canSelectReasoning}
                        onClick={() => { onReasoningEffortChange(option); setOpen(false); onClose?.(); }}
                        className={cn(
                          "flex-1 h-6 rounded text-[11px] font-medium capitalize transition-all",
                          isSelected
                            ? "bg-background text-foreground shadow-sm border border-input/30"
                            : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                        )}
                      >
                        {option}
                      </button>
                    );

                    if (description) {
                      return (
                        <Tooltip key={option}>
                          <TooltipTrigger asChild>
                            <div className="flex-1 flex">{buttonContent}</div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="max-w-xs text-xs">{description}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return buttonContent;
                  })}
                </div>
              </TooltipProvider>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <EnvKeysDialog open={envKeysOpen} onOpenChange={setEnvKeysOpen} />
    </div>
  );
}

export function ModelReasonSelector() {
  const { currentThreadId, triggerInputFocus } = useCodexStore();
  const { openAiModels } = useModels();

  const {
    modelProvider,
    providerModels,
    setModel,
    setModelProvider,
    reasoningEffort,
    setReasoningEffort,
  } = useConfigStore();

  useEffect(() => {
    if (modelProvider === 'openai' && !providerModels['openai'] && openAiModels.length > 0) {
      const defaultModel = openAiModels.find((m) => m.isDefault) ?? openAiModels[0];
      setModel(defaultModel.id);
      setReasoningEffort(defaultModel.defaultReasoningEffort);
    }
  }, [openAiModels.length, modelProvider]);

  const onProviderChange = (p: Provider) => {
    setModelProvider(p);
    if (p === 'openai') {
      const savedModel = providerModels['openai'];
      const selected = openAiModels.find((m) => m.id === savedModel);
      if (selected) {
        setReasoningEffort(selected.defaultReasoningEffort);
      } else if (openAiModels.length > 0) {
        const fallback = openAiModels.find((m) => m.isDefault) ?? openAiModels[0];
        setModel(fallback.id);
        setReasoningEffort(fallback.defaultReasoningEffort);
      }
    } else if (!GENERIC_REASONING_OPTIONS.includes(reasoningEffort)) {
      setReasoningEffort('medium');
    }
    if (currentThreadId) {
      void codexService.threadResume(currentThreadId);
    }
  };

  return (
    <BaseModelSelector
      provider={modelProvider}
      onProviderChange={onProviderChange}
      value={providerModels[modelProvider] ?? ''}
      onValueChange={setModel}
      reasoningEffort={reasoningEffort}
      onReasoningEffortChange={setReasoningEffort}
      onClose={triggerInputFocus}
    />
  );
}

type CodexModelSelectorProps = {
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  value: string;
  onValueChange: (value: string) => void;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (value: ReasoningEffort) => void;
  disabled?: boolean;
};

export function CodexModelSelector({
  provider,
  onProviderChange,
  value,
  onValueChange,
  reasoningEffort,
  onReasoningEffortChange,
  disabled = false,
}: CodexModelSelectorProps) {

  return (
    <BaseModelSelector
      provider={provider}
      onProviderChange={onProviderChange}
      value={value}
      onValueChange={onValueChange}
      reasoningEffort={reasoningEffort}
      onReasoningEffortChange={onReasoningEffortChange}
      disabled={disabled}
    />
  );
}