import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleNewThread = vi.hoisted(() => vi.fn());
vi.mock('@/components/codex/hooks', () => ({ useNewThread: () => ({ handleNewThread }) }));
vi.mock('@/components/codex/thread/ThreadList', () => ({
  ThreadList: ({ projectId }: { projectId?: string | null }) => (
    <div data-testid={`threads-${projectId ?? 'recent'}`} />
  ),
}));

import { useServerProjectsStore } from '@/features/projects/useServerProjectsStore';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { SideBarRecentChats } from './SideBarRecentChats';

beforeEach(() => {
  vi.clearAllMocks();
  useServerProjectsStore.setState({ status: 'ready' });
  useAgentSettingsStore.setState({ selectedAgent: 'codex' });
  useAcpStore.setState({ active: false });
  useWorkspaceStore.setState({ cwd: '/work/alpha' });
});

describe('SideBarRecentChats', () => {
  it('lists unassigned codex chats as its own section', () => {
    render(<SideBarRecentChats />);
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByTestId('threads-recent')).toBeTruthy();
  });

  it('starts a chat outside any project', () => {
    render(<SideBarRecentChats />);
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(useWorkspaceStore.getState().cwd).toBeNull();
    expect(handleNewThread).toHaveBeenCalled();
  });

  it('is hidden for other agents and without server projects', () => {
    useAgentSettingsStore.setState({ selectedAgent: 'cc' });
    const { rerender } = render(<SideBarRecentChats />);
    expect(screen.queryByText('Recent')).toBeNull();

    useAgentSettingsStore.setState({ selectedAgent: 'codex' });
    useServerProjectsStore.setState({ status: 'loading' });
    rerender(<SideBarRecentChats />);
    expect(screen.queryByText('Recent')).toBeNull();
  });
});
