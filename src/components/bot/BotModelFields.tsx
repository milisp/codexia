import { AcpChoiceMenu } from '@/components/acp/AcpChoiceMenu';
import { Label } from '@/components/ui/label';
import { useBotOptionsStore } from '@/stores/useBotOptionsStore';
import { useEffect, useRef, useState } from 'react';
import { ProviderNotSignedInError, probeProviderModels } from './probeProviderModels';

interface BotModelFieldsProps {
  /** Working directory keke is opened in to list a provider's models. */
  cwd: string;
  provider: string;
  onProviderChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  reasoningEffort: string;
  onReasoningEffortChange: (value: string) => void;
}

/**
 * Account, model and reasoning effort for a bot, driven by the cached
 * catalogue instead of a live agent.
 * Picks land in the draft and are applied when the bot next starts, which is
 * the only difference from the composer's copy.
 */
export function BotModelFields({
  cwd,
  provider,
  onProviderChange,
  model,
  onModelChange,
  reasoningEffort,
  onReasoningEffortChange,
}: BotModelFieldsProps) {
  const authMethods = useBotOptionsStore((s) => s.authMethods);
  // keke advertises models per provider, so only the picked provider's list
  // is shown; one this bot has never run on has none yet.
  const providerCatalogue = useBotOptionsStore((s) => s.byProvider[provider]);
  const catalogue = providerCatalogue?.configOptions ?? [];
  const models = providerCatalogue?.models ?? null;

  // The catalogue only carries what keke offers; what this bot has chosen
  // lives in the draft, so the current values are grafted on here.
  const configOptions = catalogue.map((option) => ({
    ...option,
    currentValue: option.category === 'thought_level' ? reasoningEffort : model,
    options: option.options ?? [],
  }));

  // The user must pick a provider and model explicitly; no "keke's default"
  // escape hatch is offered, and neither field starts out selected.
  const known = authMethods.length > 0;
  const noModels = configOptions.length === 0 && models === null;

  // A provider keke has never been asked about is probed when it is picked.
  // The effect only reruns when its inputs change, so a failed probe is not
  // retried in a loop, but picking another provider and coming back tries again.
  const [failure, setFailure] = useState<{ provider: string; signIn: boolean } | null>(null);
  const probed = useRef(new Set<string>());
  useEffect(() => {
    if (!provider || !noModels || !cwd || probed.current.has(provider)) return;
    probed.current.add(provider);
    setFailure(null);
    probeProviderModels(provider, cwd).catch((e) => {
      console.warn(`bot: could not list models for ${provider}`, e);
      probed.current.delete(provider);
      setFailure({ provider, signIn: e instanceof ProviderNotSignedInError });
    });
  }, [provider, noModels, cwd]);
  const failed = failure?.provider === provider ? failure : null;

  return (
    <div className="space-y-1">
      <Label>Model</Label>
      {known ? (
        <>
          <div className="flex">
            <AcpChoiceMenu
              authMethods={authMethods}
              selectedAuthMethod={provider}
              onSelectAuthMethod={(value) => {
                if (value === provider) return;
                onProviderChange(value);
                // The previous model belongs to the previous provider.
                onModelChange('');
                onReasoningEffortChange('');
              }}
              configOptions={configOptions}
              onConfigOptionChange={(option, value) => {
                if (typeof value !== 'string') return;
                if (option.category === 'thought_level') onReasoningEffortChange(value);
                else {
                  onModelChange(value);
                  // A model switch can invalidate the previous effort level.
                  onReasoningEffortChange('');
                }
              }}
              models={models ? { ...models, currentModelId: model } : null}
              reasoningEffort={reasoningEffort || null}
              onModelChange={(modelId, effort) => {
                onModelChange(modelId);
                onReasoningEffortChange(effort ?? '');
              }}
              accountLabel="Provider"
              noAccountLabel="Select a provider"
              placeholder="Select a model"
              triggerClassName="flex max-w-full items-center gap-1 truncate rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
            />
          </div>
          {provider && noModels && (
            <p className="text-xs text-muted-foreground">
              {failed?.signIn
                ? 'Not signed in to this provider. Run `keke login` for it, then pick it again.'
                : failed
                  ? "Could not list this provider's models."
                  : 'Loading models…'}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Open a bot's chat once so keke can report the accounts and models it offers — the picker
          appears here afterwards, and until then the bot uses keke's defaults.
        </p>
      )}
    </div>
  );
}