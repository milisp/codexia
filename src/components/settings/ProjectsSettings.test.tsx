import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsSettings } from './ProjectsSettings';

const remove = vi.fn();
const setProjects = vi.fn();

vi.mock('@/features/projects/useServerProjectsStore', () => ({
  useServerProjectsStore: {
    getState: () => ({
      status: 'ready',
      projects: [{ id: 'p1', name: 'app', roots: [{ path: '/code/app' }] }],
      remove,
      moveBefore: vi.fn(),
    }),
  },
}));

vi.mock('@/features/projects/projectModel', () => ({
  findProjectForCwd: (_projects: unknown, cwd: string) => (cwd === '/code/app' ? { id: 'p1' } : null),
}));

vi.mock('@/stores/useWorkspaceStore', () => ({
  useWorkspaceStore: () => ({
    projects: ['/code/app'],
    setProjects,
    cwd: '/code/app',
    setCwd: vi.fn(),
  }),
}));

vi.mock('@/components/ui/use-toast', () => ({ toast: { error: vi.fn() } }));

describe('ProjectsSettings delete', () => {
  beforeEach(() => {
    remove.mockReset();
    setProjects.mockReset();
  });

  it('asks before deleting and only removes the project after confirming', async () => {
    remove.mockResolvedValue(undefined);
    render(<ProjectsSettings />);

    fireEvent.click(screen.getByTitle('Delete project'));
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('p1'));
    expect(setProjects).toHaveBeenCalledWith([]);
  });

  it('keeps the project locally when the server rejects the delete', async () => {
    remove.mockRejectedValue(new Error('nope'));
    render(<ProjectsSettings />);

    fireEvent.click(screen.getByTitle('Delete project'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
    expect(setProjects).not.toHaveBeenCalled();
  });
});
