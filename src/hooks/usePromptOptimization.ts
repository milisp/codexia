import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { optimizePromptRequest } from '@/services/promptOptimizer';
import { usePromptOptimizerStore } from '@/stores/PromptOptimizerStore';
import { Provider, useProvidersStore } from '@/stores/ProvidersStore';

interface UsePromptOptimizationOptions {
  inputValue: string;
  disabled?: boolean;
  onInputChange: (value: string) => void;
  pushPromptHistory: (value: string) => void;
  popPromptHistory: () => string | null;
  promptHistoryLength: number;
}

export const usePromptOptimization = ({
  inputValue,
  disabled = false,
  onInputChange,
  pushPromptHistory,
  popPromptHistory,
  promptHistoryLength,
}: UsePromptOptimizationOptions) => {
  const providers = useProvidersStore((state) => state.providers);
  const optimizerProvider = usePromptOptimizerStore((state) => state.provider);
  const optimizerModel = usePromptOptimizerStore((state) => state.model);

  const typedProvider = optimizerProvider as Provider;
  const optimizerConfig = providers[typedProvider];
  const availableOptimizerModels = optimizerConfig?.models ?? [];
  const activeOptimizerModel = useMemo(() => (
    availableOptimizerModels.includes(optimizerModel)
      ? optimizerModel
      : availableOptimizerModels[0] ?? ''
  ), [availableOptimizerModels, optimizerModel]);

  const trimmedApiKey = optimizerConfig?.apiKey?.trim() ?? '';
  const requiresApiKey = typedProvider !== 'ollama';
  const hasCredentials = !requiresApiKey || Boolean(trimmedApiKey);
  const credentialMessage = hasCredentials
    ? ''
    : 'Configure the prompt optimizer under Settings > Prompt optimizer.';

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasOptimized, setHasOptimized] = useState(false);

  useEffect(() => {
    if (!inputValue.trim()) {
      setHasOptimized(false);
    }
  }, [inputValue]);

  const handleOptimizePrompt = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isOptimizing || hasOptimized || !activeOptimizerModel || disabled) {
      return;
    }

    if (!hasCredentials) {
      toast.error(credentialMessage || 'Configure the prompt optimizer under Settings.');
      return;
    }

    pushPromptHistory(inputValue);
    setIsOptimizing(true);

    try {
      const optimized = await optimizePromptRequest({
        prompt: trimmed,
        provider: optimizerProvider,
        model: activeOptimizerModel,
        apiKey: optimizerConfig?.apiKey || undefined,
        baseUrl: optimizerConfig?.baseUrl || undefined,
      });

      if (optimized) {
        onInputChange(optimized);
        setHasOptimized(true);
      } else {
        popPromptHistory();
      }
    } catch (error) {
      console.error('Failed to optimize prompt:', error);
      popPromptHistory();
      setHasOptimized(false);
    } finally {
      setIsOptimizing(false);
    }
  }, [
    inputValue,
    isOptimizing,
    hasOptimized,
    activeOptimizerModel,
    disabled,
    pushPromptHistory,
    optimizerProvider,
    optimizerConfig?.apiKey,
    optimizerConfig?.baseUrl,
    onInputChange,
    popPromptHistory,
  ]);

  const handleUndoOptimization = useCallback(() => {
    const previousValue = popPromptHistory();
    if (previousValue !== null) {
      onInputChange(previousValue);
      setHasOptimized(false);
    }
  }, [popPromptHistory, onInputChange]);

  const resetOptimizationState = useCallback(() => {
    setHasOptimized(false);
    setIsOptimizing(false);
  }, []);

  const canOptimize = Boolean(inputValue.trim()) && !disabled && !!activeOptimizerModel && !isOptimizing && !hasOptimized && hasCredentials;
  const canUndo = hasOptimized && promptHistoryLength > 0;

  return {
    isOptimizing,
    hasOptimized,
    canOptimize,
    canUndo,
    activeOptimizerModel,
    optimizePrompt: handleOptimizePrompt,
    undoOptimization: handleUndoOptimization,
    resetOptimizationState,
    credentialMessage,
  };
};
