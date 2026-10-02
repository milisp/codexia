import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AcpAuthMethod,
  AcpConfigOption,
  AcpInitializeResult,
  AcpModelState,
  AcpSessionResult,
} from '@/services/apiAdapt/acp';

/** Models and efforts one provider offered; keke reports them per provider. */
export interface ProviderCatalogue {
  /** Model / effort options only; `currentValue` here is meaningless. */
  configOptions: AcpConfigOption[];
  models: AcpModelState | null;
}

/**
 * The accounts, models and reasoning efforts keke last advertised.
 *
 * keke only reports these over a live connection, but a bot is configured
 * before it has ever run — including right after "New bot". Caching the last
 * live catalogue lets the settings dialog drive the very same `AcpChoiceMenu`
 * the composer uses, instead of falling back to free-text inputs.
 *
 * Stored in the agent's own shapes so no translation is needed at either end.
 */
interface BotOptionsStore {
  authMethods: AcpAuthMethod[];
  /**
   * Keyed by provider id (`''` for keke's default). A bot's process is spawned
   * with `--provider`, so the models it advertises belong to that provider
   * only and must not be shown for another one.
   */
  byProvider: Record<string, ProviderCatalogue>;
  setCatalogue: (
    provider: string,
    catalogue: {
      authMethods: AcpAuthMethod[];
      configOptions: AcpConfigOption[];
      models: AcpModelState | null;
    }
  ) => void;
}

export const useBotOptionsStore = create<BotOptionsStore>()(
  persist(
    (set) => ({
      authMethods: [],
      byProvider: {},
      setCatalogue: (provider, { authMethods, configOptions, models }) =>
        set((state) => {
          const previous = state.byProvider[provider];
          return {
            // A connection that advertises nothing must not wipe what we know.
            authMethods: authMethods.length ? authMethods : state.authMethods,
            byProvider: {
              ...state.byProvider,
              [provider]: {
                configOptions: configOptions.length
                  ? configOptions
                  : (previous?.configOptions ?? []),
                models: models?.availableModels.length ? models : (previous?.models ?? null),
              },
            },
          };
        }),
    }),
    { name: 'bot-options-storage', version: 3, migrate: () => ({}) as Partial<BotOptionsStore> }
  )
);

/** Record what a freshly opened keke session offers for the provider it runs on. */
export function captureBotOptions(
  provider: string | null | undefined,
  initialize: AcpInitializeResult | null,
  session: AcpSessionResult | null
) {
  useBotOptionsStore.getState().setCatalogue(provider ?? '', {
    authMethods: initialize?.authMethods ?? [],
    // `mode` is per-conversation, not a bot setting; trust level covers it.
    configOptions: (session?.configOptions ?? []).filter(
      (o) =>
        o.category === 'model' || o.category === 'model_config' || o.category === 'thought_level'
    ),
    models: session?.models ?? null,
  });
}