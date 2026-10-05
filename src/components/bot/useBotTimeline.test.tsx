import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcpStore } from '@/stores/useAcpStore';

const getSession = vi.fn();
const listSessions = vi.fn();
let activity: (event: { data: string }) => void;
vi.mock('@/services/apiAdapt/acp', () => ({ acpGetSession: (...args: unknown[]) => getSession(...args) }));
vi.mock('@/services/apiAdapt/bots', () => ({ listBotSessions: (...args: unknown[]) => listSessions(...args) }));
vi.mock('@/hooks/runtime', () => ({ isDesktopTauri: () => false, buildEventUrl: () => '/events' }));
import { useBotTimeline } from './useBotTimeline';

const said = (text: string) => ({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });
const record = (sessionId: string, createdAt: string) => ({ sessionId, createdAt });
const texts = (sections: ReturnType<typeof useBotTimeline>['sections']) =>
  sections.flatMap((section) => section.entries.map((entry) => entry.role === 'tool' ? entry.title : entry.text));

beforeEach(() => {
  vi.clearAllMocks();
  useAcpStore.getState().reset();
  vi.stubGlobal('EventSource', class {
    set onmessage(handler: typeof activity) { activity = handler; }
    close() {}
  });
});

describe('continuous Bot timeline', () => {
  it('loads every saved transcript chronologically, skips empty records and keeps sessions separate', async () => {
    listSessions.mockResolvedValue([record('live', '4'), record('scheduled', '3'), record('empty', '2'), record('old', '1')]);
    getSession.mockImplementation(async (id: string) => id === 'empty' ? [] : [said(id), said(' result')]);
    const { result } = renderHook(() => useBotTimeline('bot', 'live'));
    await waitFor(() => expect(texts(result.current.sections)).toEqual(['old result', 'scheduled result']));
    expect(getSession).not.toHaveBeenCalledWith('live');
    expect(useAcpStore.getState().entries).toEqual([]);
  });

  it('adds a completed scheduled run without changing the live messages or permissions', async () => {
    listSessions.mockResolvedValue([record('live', '1')]);
    const { result } = renderHook(() => useBotTimeline('bot', 'live'));
    await waitFor(() => expect(result.current.sections).toHaveLength(1));
    useAcpStore.getState().addEntry({ id: 'live-message', role: 'agent', text: 'still streaming' });
    listSessions.mockResolvedValue([record('scheduled', '2'), record('live', '1')]);
    getSession.mockResolvedValue([said('scheduled result'), { sessionUpdate: 'config_option_update', configOptions: [{ id: 'bad' }] }]);
    act(() => activity({ data: JSON.stringify({ event: 'bot:activity', payload: { botId: 'bot', status: 'done' } }) }));
    await waitFor(() => expect(texts(result.current.sections)).toEqual(['scheduled result']));
    expect(useAcpStore.getState().entries).toEqual([{ id: 'live-message', role: 'agent', text: 'still streaming' }]);
    expect(useAcpStore.getState().configOptions).toEqual([]);
  });

  it('does not leak a slow timeline into another Bot', async () => {
    let release: (value: unknown[]) => void = () => {};
    const slow = new Promise<unknown[]>((resolve) => { release = resolve; });
    listSessions.mockImplementation(async (id: string) => [record(id, '1')]);
    getSession.mockImplementation((id: string) => id === 'first' ? slow : Promise.resolve([said('second')]));
    const { result, rerender } = renderHook(({ id }) => useBotTimeline(id), { initialProps: { id: 'first' } });
    await waitFor(() => expect(getSession).toHaveBeenCalledWith('first'));
    rerender({ id: 'second' });
    await waitFor(() => expect(texts(result.current.sections)).toEqual(['second']));
    await act(async () => release([said('first')]));
    expect(texts(result.current.sections)).toEqual(['second']);
  });

  it('offers retry instead of silently dropping a failed transcript', async () => {
    listSessions.mockResolvedValue([record('old', '1')]);
    getSession.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([said('recovered')]);
    const { result } = renderHook(() => useBotTimeline('bot'));
    await waitFor(() => expect(result.current.error).toContain('offline'));
    act(() => result.current.retry());
    await waitFor(() => expect(texts(result.current.sections)).toEqual(['recovered']));
    expect(result.current.error).toBe('');
  });
});
