import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcpChoiceMenu } from './AcpChoiceMenu';

Element.prototype.scrollIntoView = vi.fn();

describe('AcpChoiceMenu embedded keyboard navigation', () => {
  it('opens a setting with Enter, chooses with arrows and Enter, and returns to the overview', async () => {
    const onConfigOptionChange = vi.fn();
    const { container } = render(
      <AcpChoiceMenu
        embedded
        authMethods={[]}
        selectedAuthMethod={null}
        onSelectAuthMethod={vi.fn()}
        configOptions={[{
          id: 'model', name: 'Model', type: 'select', category: 'model', currentValue: 'first',
          options: [{ value: 'first', name: 'First' }, { value: 'second', name: 'Second' }],
        }]}
        onConfigOptionChange={onConfigOptionChange}
        models={null}
        reasoningEffort={null}
        onModelChange={vi.fn()}
      />
    );

    const command = container.querySelector<HTMLElement>('[cmdk-root]')!;
    await waitFor(() => expect(document.activeElement).toBe(command));
    fireEvent.keyDown(command, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('First')).toBeTruthy());
    const detail = container.querySelector<HTMLElement>('[cmdk-root]')!;
    await waitFor(() => expect(document.activeElement).toBe(detail));
    fireEvent.keyDown(detail, { key: 'ArrowDown' });
    fireEvent.keyDown(detail, { key: 'Enter' });

    expect(onConfigOptionChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'model' }), 'second');
    await waitFor(() => expect(within(container.querySelector<HTMLElement>('[cmdk-root]')!).queryByText('Second')).toBeNull());
    expect(document.activeElement).toBe(container.querySelector('[cmdk-root]'));
  });

  it('opens with ArrowRight and returns with ArrowLeft without closing the panel', async () => {
    const { container } = render(
      <AcpChoiceMenu
        embedded
        authMethods={[{ id: 'account-1', name: 'Account one' }]}
        selectedAuthMethod={null}
        onSelectAuthMethod={vi.fn()}
        configOptions={[]}
        onConfigOptionChange={vi.fn()}
        models={null}
        reasoningEffort={null}
        onModelChange={vi.fn()}
      />
    );
    const command = container.querySelector<HTMLElement>('[cmdk-root]')!;
    await waitFor(() => expect(document.activeElement).toBe(command));
    fireEvent.keyDown(command, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText('Account one')).toBeTruthy());
    fireEvent.keyDown(container.querySelector<HTMLElement>('[cmdk-root]')!, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.queryByText('Account one')).toBeNull());
    expect(document.activeElement).toBe(container.querySelector('[cmdk-root]'));
  });

  it('returns to the overview with Escape without closing the panel', async () => {
    const { container } = render(
      <AcpChoiceMenu
        embedded
        authMethods={[{ id: 'account-1', name: 'Account one' }]}
        selectedAuthMethod={null}
        onSelectAuthMethod={vi.fn()}
        configOptions={[]}
        onConfigOptionChange={vi.fn()}
        models={null}
        reasoningEffort={null}
        onModelChange={vi.fn()}
      />
    );
    await waitFor(() => expect(document.activeElement).toBe(container.querySelector('[cmdk-root]')));
    fireEvent.keyDown(container.querySelector<HTMLElement>('[cmdk-root]')!, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Account one')).toBeTruthy());
    fireEvent.keyDown(container.querySelector<HTMLElement>('[cmdk-root]')!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Account one')).toBeNull());
    expect(document.activeElement).toBe(container.querySelector('[cmdk-root]'));
  });
});
