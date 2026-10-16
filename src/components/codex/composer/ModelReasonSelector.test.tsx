import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodexModelSelector } from './ModelReasonSelector';

// cmdk scrolls the active item into view; jsdom does not implement it.
Element.prototype.scrollIntoView = vi.fn();

vi.mock('../hooks/useModels', () => ({
  useModels: () => ({
    openAiModels: [],
    allProviders: ['openai', 'nvidia'],
    // A provider with no user-added models yet: nothing listed, one llms.json suggestion.
    providerItems: () => [],
    providerSuggestions: (provider: string) =>
      provider === 'nvidia' ? [{ id: 'nvidia/nemotron', label: 'nvidia/nemotron' }] : [],
  }),
}));

vi.mock('@/stores/settings', () => ({
  useModelSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({ models: {}, addModel: vi.fn(), removeModel: vi.fn() }),
}));

vi.mock('@/stores/useAgentSettingsStore', () => ({
  useAgentSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({ selectedAgent: 'codex' }),
}));

vi.mock('@/components/codex/stores', () => ({
  useCodexStore: () => ({}),
  useConfigStore: () => ({}),
}));

vi.mock('@/services/codexService', () => ({ codexService: {} }));
vi.mock('@/components/common/AgentIcon', () => ({ AgentIcon: () => null }));
vi.mock('@/components/icons', () => ({ ProviderIcons: () => null }));
vi.mock('./EnvKeysDialog', () => ({ EnvKeysDialog: () => null }));

describe('CodexModelSelector panel mode', () => {
  it('offers suggested models and manual entry for a provider without saved models', () => {
    render(
      <CodexModelSelector
        mode="panel"
        provider="nvidia"
        onProviderChange={vi.fn()}
        value=""
        onValueChange={vi.fn()}
      />
    );

    expect(screen.getByRole('option', { name: 'nvidia/nemotron' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Add model id...')).toBeTruthy();
  });
});
