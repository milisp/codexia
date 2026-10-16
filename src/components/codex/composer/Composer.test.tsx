import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const threadQueueAdd = vi.fn();
const turnSteer = vi.fn();
const turnStart = vi.fn();
vi.mock('@/services/codexService', () => ({
  codexService: {
    threadQueueAdd: (...a: unknown[]) => threadQueueAdd(...a),
    turnSteer: (...a: unknown[]) => turnSteer(...a),
    turnStart: (...a: unknown[]) => turnStart(...a),
    turnInterrupt: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

// Heavy collaborators that have nothing to do with the send path.
vi.mock('./QueuedMessages', () => ({ QueuedMessages: () => null }));
vi.mock('./ComposerMenu', () => ({ ComposerMenu: () => null }));
vi.mock('./AccessModePopover', () => ({ AccessModePopover: () => null }));
vi.mock('./DictationButton', () => ({ DictationButton: () => null }));
vi.mock('./SlashCommandDialogs', () => ({ SlashCommandDialogs: () => null }));
vi.mock('./SlashCommandsSelector', () => ({ SlashCommandPopover: () => null }));
vi.mock('./ComposerToolbarContext', () => ({
  ComposerToolbarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/agent/AgentModelPanel', () => ({ AgentModelPanel: () => null }));
vi.mock('@/components/agent/AgentModelTrigger', () => ({ AgentModelTrigger: () => null }));
vi.mock('@/components/codex/widget', () => ({
  ContextWindowWidget: () => null,
  ThreadCostWidget: () => null,
}));
vi.mock('@/components/common', () => ({ FileMentionPopover: () => null }));
vi.mock('./editor/ComposerEditor', () => ({
  ComposerEditor: forwardRef(function ComposerEditorStub(
    props: { value: string; onChange: (v: string) => void },
    ref
  ) {
    useImperativeHandle(ref, () => ({ focus: () => {} }));
    return (
      <textarea
        aria-label="Message"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  }),
}));

import { useCodexStore } from '@/components/codex/stores';
import { useInputStore } from '@/stores/useInputStore';
import { Composer } from './Composer';

const setThread = (active: boolean) =>
  useCodexStore.setState({
    currentThreadId: 't1',
    currentTurnId: 'turn-1',
    threadStatusMap: { t1: active ? { type: 'active', activeFlags: [] } : { type: 'idle' } },
    turnTimingMap: {},
  });

describe('Composer while a turn runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInputStore.setState({ inputValue: 'follow up' });
  });

  it('queues the message on the server and clears the input', async () => {
    setThread(true);
    threadQueueAdd.mockResolvedValue({ id: 'q1' });
    render(<Composer />);

    fireEvent.click(screen.getByRole('button', { name: 'Queue message' }));

    await waitFor(() => expect(threadQueueAdd).toHaveBeenCalledWith('t1', 'follow up', []));
    await waitFor(() => expect(useInputStore.getState().inputValue).toBe(''));
    expect(turnSteer).not.toHaveBeenCalled();
  });

  it('keeps the draft when the server rejects the queued message', async () => {
    setThread(true);
    threadQueueAdd.mockRejectedValue(new Error('queue unavailable'));
    render(<Composer />);

    fireEvent.click(screen.getByRole('button', { name: 'Queue message' }));

    await waitFor(() => expect(threadQueueAdd).toHaveBeenCalled());
    expect(useInputStore.getState().inputValue).toBe('follow up');
  });

  it('offers no queue button while the thread is idle', () => {
    setThread(false);
    render(<Composer />);
    expect(screen.queryByRole('button', { name: 'Queue message' })).toBeNull();
  });
});
