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

import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useImportedPathsStore, useServerProjectsStore } from './useServerProjectsStore';

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
    const created = project(`p-${params.idempotencyKey}`, params.roots.map((r: { path: string }) => r.path));
    server = [...server, created];
    return { project: created };
  });
  api.createProject.mockImplementation(async (params) => {
    const created = project(`c-${params.idempotencyKey}`, params.roots.map((r: { path: string }) => r.path));
    server = [...server, created];
    return { project: created };
  });
  api.updateProject.mockResolvedValue({});
  api.deleteProject.mockResolvedValue({});
  api.archiveThread.mockResolvedValue({});
  useServerProjectsStore.setState({ projects: [], status: 'idle', threadsVersion: 0 });
  useImportedPathsStore.setState({ imported: [] });
  useWorkspaceStore.setState({ projects: [], cwd: null });
});

describe('refresh', () => {
  it('loads every page and mirrors primary roots into the cwd project list', async () => {
    api.listProjects
      .mockResolvedValueOnce({ data: [project('a', ['/a', '/a2'])], nextCursor: 'next' })
      .mockResolvedValueOnce({ data: [project('b', ['/b'])], nextCursor: null });

    await useServerProjectsStore.getState().refresh();

    expect(useServerProjectsStore.getState().status).toBe('ready');
    expect(useServerProjectsStore.getState().projects.map((p) => p.id)).toEqual(['a', 'b']);
    expect(api.listProjects).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next' }));
    expect(useWorkspaceStore.getState().projects).toEqual(['/a', '/b']);
  });

  it('keeps local projects that were never offered, and drops ones deleted on the server', async () => {
    useWorkspaceStore.setState({ projects: ['/work/pending', '/work/deleted', '/work/kept'] });
    useImportedPathsStore.setState({ imported: ['/work/deleted', '/work/kept'] });
    server = [project('k', ['/work/kept'])];

    await useServerProjectsStore.getState().refresh();

    expect(useWorkspaceStore.getState().projects).toEqual(['/work/kept', '/work/pending']);
  });

  it('reports servers without a project store as unsupported', async () => {
    api.listProjects.mockRejectedValue(new Error('project/list is unavailable without sqlite state'));
    await useServerProjectsStore.getState().refresh();
    expect(useServerProjectsStore.getState().status).toBe('unsupported');
  });

  it('keeps a transient failure retryable', async () => {
    api.listProjects.mockRejectedValue(new Error('codex backend is not available'));
    await useServerProjectsStore.getState().refresh();
    expect(useServerProjectsStore.getState().status).toBe('error');
  });
});

describe('importPaths', () => {
  it('imports only local projects the server lacks, adopting their unassigned chats', async () => {
    server = [project('existing', ['/work/known'])];
    await useServerProjectsStore.getState().refresh();
    api.listThreads.mockResolvedValue({ data: [{ id: 't1' }, { id: 't2' }], nextCursor: null });

    const handled = await useServerProjectsStore
      .getState()
      .importPaths(['/work/known', '/work/new', '/work/new/']);

    expect(handled).toEqual(['/work/new']);
    expect(api.importProject).toHaveBeenCalledTimes(1);
    expect(api.importProject).toHaveBeenCalledWith({
      name: 'new',
      roots: [{ path: '/work/new' }],
      threads: ['t1', 't2'],
      idempotencyKey: 'codexia:import:/work/new',
    });
    expect(api.listThreads).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/work/new', projectId: null })
    );
  });

  it('does not duplicate projects when run twice', async () => {
    await useServerProjectsStore.getState().refresh();
    await useServerProjectsStore.getState().importPaths(['/work/new']);
    await useServerProjectsStore.getState().importPaths(['/work/new']);
    expect(api.importProject).toHaveBeenCalledTimes(1);
    expect(server).toHaveLength(1);
  });

  it('does not re-offer a path at startup after it was imported once', async () => {
    await useServerProjectsStore.getState().refresh();
    await useServerProjectsStore.getState().importPaths(['/work/gone']);
    // Deleted on another client.
    server = [];
    await useServerProjectsStore.getState().refresh();
    api.importProject.mockClear();

    await useServerProjectsStore.getState().importPaths(['/work/gone']);
    expect(api.importProject).not.toHaveBeenCalled();

    // The user adding the folder again does create it, with a fresh key.
    api.importProject.mockRejectedValueOnce(new Error('idempotency key refers to deleted project'));
    await useServerProjectsStore.getState().importPaths(['/work/gone'], { interactive: true });
    expect(api.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ roots: [{ path: '/work/gone' }] })
    );
  });

  it('still creates the project when adopting chats fails', async () => {
    await useServerProjectsStore.getState().refresh();
    api.importProject.mockRejectedValueOnce(new Error('duplicate thread id'));
    const handled = await useServerProjectsStore.getState().importPaths(['/work/x']);
    expect(handled).toEqual(['/work/x']);
    expect(api.createProject).toHaveBeenCalledTimes(1);
  });
});

describe('project actions', () => {
  const p = project('a', ['/one', '/two']);

  it('makes a folder primary by reordering the roots', async () => {
    await useServerProjectsStore.getState().makePrimary(p, '/two');
    expect(api.updateProject).toHaveBeenCalledWith({
      projectId: 'a',
      roots: [{ path: '/two' }, { path: '/one' }],
    });
  });

  it('adds and removes folders through project/update', async () => {
    await useServerProjectsStore.getState().addRoot(p, '/three');
    expect(api.updateProject).toHaveBeenLastCalledWith({
      projectId: 'a',
      roots: [{ path: '/one' }, { path: '/two' }, { path: '/three' }],
    });
    await useServerProjectsStore.getState().removeRoot(p, '/one');
    expect(api.updateProject).toHaveBeenLastCalledWith({ projectId: 'a', roots: [{ path: '/two' }] });
  });

  it('renames a project', async () => {
    await useServerProjectsStore.getState().rename('a', 'Renamed');
    expect(api.updateProject).toHaveBeenCalledWith({ projectId: 'a', name: 'Renamed' });
  });

  it('deletes a project', async () => {
    useServerProjectsStore.setState({ projects: [p], status: 'ready' });
    await useServerProjectsStore.getState().remove('a');
    expect(api.deleteProject).toHaveBeenCalledWith({ projectId: 'a' });
  });

  it('archives every chat in the project across pages, using the existing archive call', async () => {
    api.listThreads
      .mockResolvedValueOnce({ data: [{ id: 't1' }, { id: 't2' }], nextCursor: 'c' })
      .mockResolvedValueOnce({ data: [{ id: 't3' }], nextCursor: null });

    const count = await useServerProjectsStore.getState().archiveChats('a');

    expect(count).toBe(3);
    expect(api.listThreads).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'a' }));
    expect(api.archiveThread.mock.calls.map((c) => c[0])).toEqual(['t1', 't2', 't3']);
    expect(useServerProjectsStore.getState().threadsVersion).toBe(1);
  });
});
