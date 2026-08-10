import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationTask } from '@/services/apiAdapt';
import { ManageDialog } from './ManageDialog';
import type { DialogMode } from './types';

// The dialog only calls these from event handlers, so stubs are enough to keep the
// tauri/http layer out of the test.
vi.mock('@/services/apiAdapt', () => ({
  createAutomation: vi.fn(),
  deleteAutomation: vi.fn(),
  setAutomationPaused: vi.fn(),
  updateAutomation: vi.fn(),
}));

vi.mock('@/components/codex/composer/index', () => ({
  CodexModelSelector: () => null,
}));

vi.mock('@/components/codex/stores', () => ({
  useConfigStore: { getState: () => ({ providerModels: { openai: 'gpt-5-codex' } }) },
}));

vi.mock('@/stores/cc', () => ({
  useCCStore: { getState: () => ({ options: { model: 'sonnet' } }) },
}));

vi.mock('@/stores/useWorkspaceStore', () => ({
  useWorkspaceStore: () => ({ projects: ['/Users/me/code/app'] }),
}));

vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

function task(overrides: Partial<AutomationTask> = {}): AutomationTask {
  return {
    id: 'automation-1',
    name: 'Nightly audit',
    projects: ['/Users/me/code/app'],
    prompt: 'audit the deps',
    agent: 'codex',
    model_provider: 'openai',
    model: 'gpt-5-codex',
    schedule: { mode: 'daily', hour: 9, minute: 0, interval_hours: null, weekdays: ['mon'] },
    cron_expression: '0 0 9 * * MON',
    created_at: '2026-01-01T00:00:00Z',
    paused: false,
    cwd_mode: 'cwd',
    ...overrides,
  };
}

function renderDialog(mode: DialogMode) {
  const props = {
    onClose: vi.fn(),
    onCreated: vi.fn(),
    onUpdated: vi.fn(),
    onDeleted: vi.fn(),
  };
  // Mount closed, then open — the dialog resets its form on that transition, which is
  // where the render-phase update lives.
  const view = render(<ManageDialog mode={null} {...props} />);
  view.rerender(<ManageDialog mode={mode} {...props} />);
  return view;
}

describe('ManageDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens in create mode without looping renders', () => {
    renderDialog({ type: 'create' });
    expect(screen.getByLabelText('Name')).toHaveProperty('value', '');
  });

  it('opens in edit mode and fills the form from the task', () => {
    renderDialog({ type: 'edit', task: task() });
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Nightly audit');
  });

  it('seeds the form from a template when creating', () => {
    renderDialog({ type: 'create', initialForm: { name: 'From template' } });
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'From template');
  });

  it('reopens on a different task without keeping the previous form', () => {
    const props = {
      onClose: vi.fn(),
      onCreated: vi.fn(),
      onUpdated: vi.fn(),
      onDeleted: vi.fn(),
    };
    const view = render(<ManageDialog mode={null} {...props} />);
    view.rerender(<ManageDialog mode={{ type: 'edit', task: task() }} {...props} />);
    view.rerender(
      <ManageDialog
        mode={{ type: 'edit', task: task({ id: 'automation-2', name: 'Weekly report' }) }}
        {...props}
      />
    );
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Weekly report');
  });

  it('defaults new automations to an isolated worktree', () => {
    renderDialog({ type: 'create' });
    expect(screen.getByRole('tab', { name: 'Git worktree' }).getAttribute('aria-selected')).toBe(
      'true'
    );
  });

  it('shows the mode stored on an existing task', () => {
    renderDialog({ type: 'edit', task: task({ cwd_mode: 'cwd' }) });
    expect(
      screen.getByRole('tab', { name: 'Project directory' }).getAttribute('aria-selected')
    ).toBe('true');
  });
});
