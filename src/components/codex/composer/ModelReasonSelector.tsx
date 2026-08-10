import { Check, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReasoningEffort } from '@/bindings';
import type { Model } from '@/bindings/v2';
import { useCodexStore, useConfigStore } from '@/components/codex/stores';
import type { ModelListItem } from '@/components/codex/types';
import { ProviderIcons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { codexService } from '@/services/codexService';
import type { Provider } from '@/stores/settings';
import { useModels } from '../hooks/useModels';
import { useComposerToolbarNarrow } from './ComposerToolbarContext';
import { EnvKeysDialog } from './EnvKeysDialog';
import { nextReasoningEffort, ReasoningEffortSelector } from './ReasoningEffortSelector';

// Models shown per provider before "Show all".
const COLLAPSED_MODEL_COUNT = 3;

function defaultOpenAiModel(models: Model[]): Model | undefined {
  return models.find((m) => m.isDefault) ?? models[0];
}

function ModelItem({
  provider,
  item,
  selected,
  showProvider,
  onSelect,
}: {
  provider: string;
  item: ModelListItem;
  selected: boolean;
  showProvider: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${provider} ${item.label} ${item.id}`}
      onSelect={onSelect}
      title={item.description}
      className={cn('gap-1.5 text-xs', !showProvider && 'pl-7')}
    >
      {showProvider && <ProviderIcons providerId={provider} size="sm" />}
      <span className="truncate">{item.label}</span>
      {showProvider && (
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{provider}</span>
      )}
      {selected && <Check className={cn('h-3.5 w-3.5 shrink-0', !showProvider && 'ml-auto')} />}
    </CommandItem>
  );
}

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
  // Providers showing their full model list instead of the first few.
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const { openAiModels, providerItems, allProviders } = useModels();
  const isNarrow = useComposerToolbarNarrow();

  const handleSelect = useCallback(
    (targetProvider: string, id: string) => {
      if (targetProvider !== provider) {
        onProviderChange(targetProvider as Provider);
      }
      onValueChange(id);

      const nextEffort = nextReasoningEffort(targetProvider, id, reasoningEffort, openAiModels);
      if (nextEffort && onReasoningEffortChange) {
        onReasoningEffortChange(nextEffort);
      }

      setOpen(false);
      onClose?.();
    },
    [
      onValueChange,
      onProviderChange,
      provider,
      openAiModels,
      onReasoningEffortChange,
      reasoningEffort,
      onClose,
    ]
  );

  const currentItems = providerItems(provider);
  const activeItem = currentItems.find((m) => m.id === value);
  const activeLabel = activeItem?.label || value || 'Select model';

  const selectedOpenAiModel =
    provider === 'openai' ? openAiModels.find((m) => m.id === value) : undefined;

  // Searching flattens the two levels into one list; cmdk does the filtering.
  const searching = searchQuery.trim().length > 0;
  const flatItems = useMemo(
    () => allProviders.flatMap((p) => providerItems(p).map((item) => ({ provider: p, item }))),
    [allProviders, providerItems]
  );

  return (
    <div className="flex items-center">
      <Popover
        open={open}
        onOpenChange={(io) => {
          setOpen(io);
          if (!io) {
            setSearchQuery('');
            setExpandedProviders(new Set());
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 border border-transparent transition-all hover:border-input hover:bg-accent/50"
            disabled={disabled}
          >
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              {provider !== 'openai' && !isNarrow && (
                <span className="font-semibold tracking-wider text-muted-foreground">
                  {provider}
                </span>
              )}
              <span className="font-medium max-w-[120px] truncate">{activeLabel}</span>
              {reasoningEffort !== undefined && reasoningEffort !== 'none' && (
                <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono capitalize text-muted-foreground border">
                  {reasoningEffort}
                </span>
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-0 flex flex-col" align="start">
          <Command loop>
            <div className="flex items-center gap-1 border-b pr-1 [&_[data-slot=command-input-wrapper]]:flex-1 [&_[data-slot=command-input-wrapper]]:border-0">
              <CommandInput
                placeholder="Search provider or model..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setEnvKeysOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            <CommandList className="max-h-64">
              <CommandEmpty className="py-4 text-xs text-muted-foreground">
                No results found
              </CommandEmpty>

              {searching
                ? flatItems.map(({ provider: p, item }) => (
                    <ModelItem
                      key={`${p}/${item.id}`}
                      provider={p}
                      item={item}
                      selected={p === provider && item.id === value}
                      showProvider
                      onSelect={() => handleSelect(p, item.id)}
                    />
                  ))
                : allProviders.map((p) => {
                    const items = providerItems(p);
                    const selectedId = p === provider ? value : undefined;
                    const expanded = expandedProviders.has(p);

                    // Collapsed groups still show the selected model, wherever it ranks.
                    let visible = items;
                    if (!expanded) {
                      visible = items.slice(0, COLLAPSED_MODEL_COUNT);
                      const selectedItem = items.find((m) => m.id === selectedId);
                      if (selectedItem && !visible.includes(selectedItem)) {
                        visible = [...visible, selectedItem];
                      }
                    }

                    return (
                      <CommandGroup
                        key={p}
                        heading={
                          <>
                            <ProviderIcons providerId={p} size="sm" />
                            {p}
                          </>
                        }
                        className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-1.5"
                      >
                        {items.length === 0 && (
                          <div className="px-2 py-1 text-xs italic text-muted-foreground/70">
                            No models
                          </div>
                        )}
                        {visible.map((item) => (
                          <ModelItem
                            key={item.id}
                            provider={p}
                            item={item}
                            selected={item.id === selectedId}
                            showProvider={false}
                            onSelect={() => handleSelect(p, item.id)}
                          />
                        ))}
                        {!expanded && items.length > visible.length && (
                          <CommandItem
                            value={`${p} show all models`}
                            onSelect={() => setExpandedProviders((prev) => new Set(prev).add(p))}
                            className="gap-1.5 pl-7 text-xs text-muted-foreground"
                          >
                            Show all {items.length} models
                            <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />
                          </CommandItem>
                        )}
                      </CommandGroup>
                    );
                  })}
            </CommandList>
          </Command>

          {reasoningEffort !== undefined && onReasoningEffortChange && (
            <ReasoningEffortSelector
              provider={provider}
              openAiModel={selectedOpenAiModel}
              value={reasoningEffort}
              onChange={(option) => {
                onReasoningEffortChange(option);
                setOpen(false);
                onClose?.();
              }}
              disabled={disabled || !value}
            />
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
    if (modelProvider === 'openai' && !providerModels.openai && openAiModels.length > 0) {
      const defaultModel = defaultOpenAiModel(openAiModels);
      if (defaultModel) {
        setModel(defaultModel.id);
        setReasoningEffort(defaultModel.defaultReasoningEffort);
      }
    }
  }, [openAiModels, modelProvider, providerModels.openai, setModel, setReasoningEffort]);

  const onProviderChange = (p: Provider) => {
    setModelProvider(p);

    let modelId = providerModels[p];
    if (p === 'openai' && !openAiModels.some((m) => m.id === modelId)) {
      const fallback = defaultOpenAiModel(openAiModels);
      if (fallback) {
        modelId = fallback.id;
        setModel(fallback.id);
      }
    }

    const nextEffort = nextReasoningEffort(p, modelId, reasoningEffort, openAiModels);
    if (nextEffort) setReasoningEffort(nextEffort);

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

export { BaseModelSelector as CodexModelSelector };
