import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerNotification } from '@/bindings/ServerNotification';

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  importProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  moveProject: vi.fn(),
  deleteProject: vi.fn(),
  listThreads: vi.fn(),
  archiveThread: vi.fn(),
  allowSleep: vi.fn().mockResolvedValue(undefined),
  preventSleep: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/apiAdapt', () => api);

import { useCodexStore } from '@/components/codex/stores';
import { isTranscriptEvent } from '@/components/codex/stores/transcriptEvents';
import { useServerProjectsStore } from '@/features/projects/useServerProjectsStore';
import { useServerNotificationHandler } from './useServerNotificationHandler';

const refs = {
  isCodexThreadActiveRef: { current: true },
  taskCompleteBeepModeRef: { current: 'never' as const },
  preventSleepDuringTasksRef: { current: false },
};

const changed = {
  method: 'project/changed',
  params: { projectId: 'p1', changeType: 'updated' },
} as ServerNotification;
const assigned = {
  method: 'thread/project/updated',
  params: { threadId: 't1', projectId: 'p1' },
} as ServerNotification;

beforeEach(() => {
  vi.clearAllMocks();
  api.listProjects.mockResolvedValue({ data: [], nextCursor: null });
  useServerProjectsStore.setState({ projects: [], status: 'ready', threadsVersion: 0 });
});

describe('project notifications', () => {
  it('refreshes the project list on project/changed without touching any transcript', () => {
    const addEvent = vi.spyOn(useCodexStore.getState(), 'addEvent');
    const { result } = renderHook(() => useServerNotificationHandler(refs, vi.fn()));

    result.current(changed);

    expect(api.listProjects).toHaveBeenCalledTimes(1);
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('reloads thread lists and updates the live thread on thread/project/updated', () => {
    useCodexStore.setState({
      threads: [{ id: 't1', projectId: null }] as never,
    });
    const addEvent = vi.spyOn(useCodexStore.getState(), 'addEvent');
    const { result } = renderHook(() => useServerNotificationHandler(refs, vi.fn()));

    result.current(assigned);

    expect(useServerProjectsStore.getState().threadsVersion).toBe(1);
    expect(useCodexStore.getState().threads[0]?.projectId).toBe('p1');
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('keeps both notifications out of the transcript', () => {
    expect(isTranscriptEvent(changed)).toBe(false);
    expect(isTranscriptEvent(assigned)).toBe(false);
  });
});
