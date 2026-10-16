import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/bindings/v2';

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  importProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  moveProject: vi.fn(),
  deleteProject: vi.fn(),
  listThreads: vi.fn(),
  archiveThread: vi.fn(),
}));
vi.mock('@/services/apiAdapt', () => api);
vi.mock('@/hooks/runtime', () => ({ isPhone: () => false, isDesktopTauri: () => false }));
vi.mock('@/features/ProjectSelector', () => ({ BrowserProjects: () => null }));
vi.mock('@/components/codex/thread/ThreadList', () => ({
  ThreadList: ({ projectId, cwd }: { projectId?: string | null; cwd?: string }) => (
    <div data-testid={`threads-${projectId ?? 'recent'}`}>{cwd ?? 'no-cwd'}</div>
  ),
}));

import { useServerProjectsStore } from '@/features/projects/useServerProjectsStore';
import { SideBarServerProjects } from './SideBarServerProjects';

const project = (id: string, name: string, roots: string[]): Project => ({
  id,
  name,
  roots: roots.map((path) => ({ path })),
  metadata: {},
  position: 0,
  createdAt: 0,
  updatedAt: 0,
  recencyAt: null,
});

const alpha = project('p1', 'Alpha', ['/work/alpha', '/work/alpha-docs']);
const empty = project('p2', 'Empty', []);

function openMenu(name: string) {
  const trigger = screen.getByRole('button', { name: `Project actions for ${name}` });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listProjects.mockImplementation(async () => ({
    data: useServerProjectsStore.getState().projects,
    nextCursor: null,
  }));
  api.updateProject.mockResolvedValue({});
  api.deleteProject.mockResolvedValue({});
  api.archiveThread.mockResolvedValue({});
  api.listThreads.mockResolvedValue({ data: [{ id: 't1' }, { id: 't2' }], nextCursor: null });
  useServerProjectsStore.setState({ projects: [alpha, empty], status: 'ready', threadsVersion: 0 });
});

describe('SideBarServerProjects', () => {
  it('lists projects with their chats, then the unassigned Recent chats', () => {
    render(<SideBarServerProjects onNewChat={vi.fn()} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByTestId('threads-p1').textContent).toBe('/work/alpha');
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByTestId('threads-recent')).toBeTruthy();
  });

  it('starts a chat in the primary folder, or outside any project from Recent', () => {
    const onNewChat = vi.fn();
    render(<SideBarServerProjects onNewChat={onNewChat} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start new thread in Alpha' }));
    expect(onNewChat).toHaveBeenLastCalledWith('/work/alpha');
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    expect(onNewChat).toHaveBeenLastCalledWith(null);
  });

  it('disables new chat for a project without folders', () => {
    render(<SideBarServerProjects onNewChat={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Start new thread in Empty' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('archives every chat in the project after confirming', async () => {
    render(<SideBarServerProjects onNewChat={vi.fn()} />);
    openMenu('Alpha');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive chats/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Archive chats' }));
    await waitFor(() => expect(api.archiveThread).toHaveBeenCalledTimes(2));
    expect(api.listThreads).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1' }));
    expect(api.archiveThread.mock.calls.map((c) => c[0])).toEqual(['t1', 't2']);
  });

  it('deletes a project only after confirmation', async () => {
    render(<SideBarServerProjects onNewChat={vi.fn()} />);
    openMenu('Alpha');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete project/ }));
    expect(api.deleteProject).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(api.deleteProject).toHaveBeenCalledWith({ projectId: 'p1' }));
  });

  it('edits a project: rename, make primary and remove a folder', async () => {
    render(<SideBarServerProjects onNewChat={vi.fn()} />);
    openMenu('Alpha');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Edit project/ }));

    const nameInput = await screen.findByRole('textbox', { name: 'Project name' });
    fireEvent.change(nameInput, { target: { value: 'Alpha 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith({ projectId: 'p1', name: 'Alpha 2' })
    );

    fireEvent.click(screen.getByRole('button', { name: /Make primary/ }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith({
        projectId: 'p1',
        roots: [{ path: '/work/alpha-docs' }, { path: '/work/alpha' }],
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove folder /work/alpha-docs' }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith({
        projectId: 'p1',
        roots: [{ path: '/work/alpha' }],
      })
    );
  });
});
