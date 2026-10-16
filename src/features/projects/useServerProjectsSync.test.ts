import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
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
vi.mock('@/hooks/runtime', () => ({ isPhone: () => false }));

import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useImportedPathsStore, useServerProjectsStore } from './useServerProjectsStore';
import { useServerProjectsSync } from './useServerProjectsSync';

const project = (id: string, roots: string[]): Project => ({
  id,
  name: id,
  roots: roots.map((path) => ({ path })),
  metadata: {},
  position: 0,
  createdAt: 0,
  updatedAt: 0,
  recencyAt: null,
});

let server: Project[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  server = [];
  api.listProjects.mockImplementation(async () => ({ data: server, nextCursor: null }));
  api.listThreads.mockResolvedValue({ data: [], nextCursor: null });
  api.importProject.mockImplementation(async (params) => {
    const created = project(
      params.idempotencyKey,
      params.roots.map((r: { path: string }) => r.path)
    );
    server = [...server, created];
    return { project: created };
  });
  useServerProjectsStore.setState({ projects: [], status: 'idle', threadsVersion: 0 });
  useImportedPathsStore.setState({ imported: [] });
  useWorkspaceStore.setState({ projects: [], cwd: null });
});

describe('useServerProjectsSync', () => {
  it('imports existing local projects once and keeps them in the sidebar list', async () => {
    useWorkspaceStore.setState({ projects: ['/work/a', '/work/b'] });
    server = [project('known', ['/work/a'])];

    renderHook(() => useServerProjectsSync());

    await waitFor(() => expect(api.importProject).toHaveBeenCalledTimes(1));
    expect(api.importProject).toHaveBeenCalledWith(
      expect.objectContaining({ roots: [{ path: '/work/b' }] })
    );
    await waitFor(() => expect(useServerProjectsStore.getState().projects).toHaveLength(2));
    expect(useWorkspaceStore.getState().projects).toEqual(['/work/a', '/work/b']);
  });

  it('makes a project of a folder added after startup', async () => {
    renderHook(() => useServerProjectsSync());
    await waitFor(() => expect(useServerProjectsStore.getState().status).toBe('ready'));

    act(() => useWorkspaceStore.getState().addProject('/work/new'));

    await waitFor(() =>
      expect(api.importProject).toHaveBeenCalledWith(
        expect.objectContaining({ roots: [{ path: '/work/new' }] })
      )
    );
  });

  it('leaves the local list alone when the server has no project store', async () => {
    useWorkspaceStore.setState({ projects: ['/work/a'] });
    api.listProjects.mockRejectedValue(new Error('project/list is unavailable without sqlite state'));

    renderHook(() => useServerProjectsSync());

    await waitFor(() => expect(useServerProjectsStore.getState().status).toBe('unsupported'));
    expect(api.importProject).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().projects).toEqual(['/work/a']);
  });
});
