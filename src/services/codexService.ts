import {
  threadFork,
  threadRollback,
  threadStart as apiThreadStart,
  threadResume,
  turnStart,
  turnInterrupt,
  threadList,
  threadArchive,
  skillList,
  gitCreateWorktree,
} from './tauri';
import type {
  Thread,
  ThreadForkParams,
  ThreadStartParams,
  ThreadListParams,
  ThreadRollbackParams,
  UserInput,
  SandboxMode,
  SandboxPolicy,
} from '@/bindings/v2';
import { useCodexStore, useConfigStore } from '@/components/codex/stores';
import { useWorkspaceStore } from '@/stores';
import { useSettingsStore } from '@/stores/settings';
import { convertThreadHistoryToEvents } from '@/utils/threadHistoryConverter';

const sandboxModeToPolicy = (mode: SandboxMode, networkAccess: boolean): SandboxPolicy => {
  switch (mode) {
    case 'read-only':
      return { type: 'readOnly', networkAccess };
    case 'workspace-write':
      return {
        type: 'workspaceWrite',
        writableRoots: [],
        networkAccess,
        excludeTmpdirEnvVar: false,
        excludeSlashTmp: false,
      };
    case 'danger-full-access':
      return { type: 'dangerFullAccess' };
  }
};

const resolveThreadCwd = (threadId: string): string | null => {
  const { threads } = useCodexStore.getState();
  const item = threads.find((thread) => thread.id === threadId);
  if (!item) {
    return null;
  }
  const cwd = item.cwd?.trim();
  return cwd ? cwd : null;
};

const generateWorktreeKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `thread-${crypto.randomUUID()}`;
  }
  return `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** Build the agents config fragment to inject into thread config params. */
const buildAgentsConfigFragment = (): Record<string, unknown> => {
  const { agentsMaxThreads, agentsMaxDepth } = useSettingsStore.getState();
  return {
    'features.multi_agents': true,
    'agents.max_threads': agentsMaxThreads,
    'agents.max_depth': agentsMaxDepth,
  };
};

const getThreadPreviewFromInput = (userInputs: UserInput[]): string => {
  for (const item of userInputs) {
    if (item.type !== 'text') {
      continue;
    }
    const text = item.text.trim();
    if (text) {
      return text;
    }
  }
  return '';
};

/** Synchronizes thread data to the Zustand store with consistent logic */
const syncThreadToStore = (
  threadId: string,
  thread: Thread,
  historicalEvents: any[],
  options: {
    resetCurrentTurnId?: boolean;
  } = {}
) => {
  const { resetCurrentTurnId = false } = options;
  const { activeThreadIds, events, threads, inputFocusTrigger } = useCodexStore.getState();

  return {
    currentThreadId: threadId,
    activeThreadIds: activeThreadIds.includes(threadId)
      ? activeThreadIds
      : [...activeThreadIds, threadId],
    threads: threads.some((t) => t.id === threadId)
      ? threads.map((t) => (t.id === threadId ? thread : t))
      : [thread, ...threads],
    events: {
      ...events,
      [threadId]: historicalEvents,
    },
    inputFocusTrigger: inputFocusTrigger + 1,
    ...(resetCurrentTurnId ? { currentTurnId: null } : {})
  };
};

export const codexService = {
  async loadThreads(
    cwd: string | null,
    archived: boolean = false,
    sortKey: 'created_at' | 'updated_at' = 'updated_at'
  ) {
    try {
      const params: ThreadListParams = {
        cursor: null,
        limit: 20,
        modelProviders: null,
        archived,
        sortKey,
        cwd
      };
      const response = await threadList(params);
      const workingDirThreads = response.data;
      const nextCursor = response.nextCursor ?? null;
      const { setThreads, setThreadListNextCursor } = useCodexStore.getState();
      setThreads(workingDirThreads);
      setThreadListNextCursor(nextCursor);
    } catch (error: unknown) {
      console.error('[CodexService] Failed to load threads:', error);
      useCodexStore.getState().setThreadListNextCursor(null);
      useCodexStore.getState().setThreads([]);
    }
  },
  async archiveThread(threadId: string) {
    try {
      await threadArchive(threadId);
    } catch (error: unknown) {
      console.error('[CodexService] archiveThread error:', error);
      throw error;
    }
  },
  async setCurrentThread(threadId: string | null, options?: { resume?: boolean }) {
    // Review-first behavior: setting the current thread no longer auto-resumes
    // the agent process. Live threads (already in activeThreadIds with cached
    // events) just switch view + derive activeTurnId. Dormant threads switch
    // view but stay disconnected — CodexThread renders an explicit Resume
    // button to spawn the agent on demand. Lets users peek at history without
    // paying the agent-spawn cost. The `options.resume` parameter is preserved
    // for API compat and will trigger a resume when requested.
    const set = useCodexStore.setState;
    try {
      if (!threadId) {
        set((state) => ({
          currentThreadId: null,
          currentTurnId: null,
          inputFocusTrigger: state.inputFocusTrigger + 1,
        }));
        return;
      }

      const state = useCodexStore.getState();

      if (state.activeThreadIds.includes(threadId) && state.events[threadId]) {
        // Live thread — derive the active turn id from streaming events so the
        // Stop button works correctly when a turn is in progress.
        const threadEvents = state.events[threadId] ?? [];
        let activeTurnId: string | null = null;
        for (let i = threadEvents.length - 1; i >= 0; i--) {
          const e = threadEvents[i];
          if (e.method === 'turn/started') {
            activeTurnId = (e.params as { turn: { id: string } }).turn.id;
            break;
          }
          if (e.method === 'turn/completed' || e.method === 'error') {
            break;
          }
        }
        set((state) => ({
          currentThreadId: threadId,
          currentTurnId: activeTurnId,
          inputFocusTrigger: state.inputFocusTrigger + 1,
        }));
      } else {
        // Dormant — view-only. User clicks Resume in CodexThread to connect.
        set((state) => ({
          currentThreadId: threadId,
          currentTurnId: null,
          inputFocusTrigger: state.inputFocusTrigger + 1,
        }));
        if (options?.resume) {
          await codexService.threadResume(threadId);
        }
      }
    } catch (error: unknown) {
      console.error('[CodexService] setCurrentThread error:', error);
      throw error;
    }
  },

  async threadStart() {
    const set = useCodexStore.setState;
    try {
      const {
        model,
        modelProvider,
        approvalPolicy,
        sandbox,
        reasoningEffort,
        webSearchRequest,
        threadCwdMode,
        collaborationMode,
      } = useConfigStore.getState();
      const { cwd } = useWorkspaceStore.getState();
      let threadCwd = cwd;
      if (threadCwdMode === 'worktree' && cwd) {
        try {
          const prepared = await gitCreateWorktree(cwd, generateWorktreeKey());
          threadCwd = prepared.worktree_path;
        } catch (error) {
          console.warn(
            '[CodexService] Failed to prepare thread worktree, fallback to workspace cwd',
            error
          );
        }
      }
      const params: ThreadStartParams = {
        model,
        modelProvider,
        cwd: threadCwd,
        approvalPolicy,
        sandbox,
        baseInstructions: null,
        developerInstructions: null,
        config: {
          model_reasoning_effort: reasoningEffort,
          show_raw_agent_reasoning: false,
          model_reasoning_summary: 'auto',
          web_search_request: webSearchRequest,
          view_image_tool: true,
          // Inject user-configured multi-agent limits.
          ...buildAgentsConfigFragment(),
          // Inject plan mode when selected.
          ...(collaborationMode === 'plan'
            ? {
              collaboration_mode: {
                mode: 'plan',
                settings: {
                  model,
                  reasoning_effort: reasoningEffort,
                  developer_instructions: null,
                },
              },
            }
            : {}),
        },
      };
      const response = await apiThreadStart(params);
      const thread = response.thread;

      set({ ...syncThreadToStore(thread.id, thread, []) });

      console.log('[CodexService] threadStart completed successfully');
      return thread;
    } catch (error: unknown) {
      console.error('[CodexService] threadStart error:', error);
      throw error;
    }
  },

  async threadResume(threadId: string) {
    const set = useCodexStore.setState;
    try {
      const response = await threadResume({
        threadId
      });
      console.log(response.thread.turns);

      const historicalEvents = convertThreadHistoryToEvents(response.thread);
      const normalized = response.thread;

      set({ ...syncThreadToStore(threadId, normalized, historicalEvents) });
    } catch (error: unknown) {
      console.error('[CodexService] threadResume error:', error);
      throw error;
    }
  },

  async threadFork(threadId: string) {
    const set = useCodexStore.setState;
    try {
      const params: ThreadForkParams = {
        threadId
      };
      const response = await threadFork(params);
      const forkedThreadId = response.thread.id;
      const historicalEvents = convertThreadHistoryToEvents(response.thread);
      const normalized = response.thread;

      set({ ...syncThreadToStore(forkedThreadId, normalized, historicalEvents, { resetCurrentTurnId: true }) });
      return normalized;
    } catch (error: unknown) {
      console.error('[CodexService] threadFork error:', error);
      throw error;
    }
  },

  async threadRollback(threadId: string, numTurns: number) {
    const set = useCodexStore.setState;
    try {
      const params: ThreadRollbackParams = {
        threadId,
        numTurns,
      };
      const response = await threadRollback(params);
      const historicalEvents = convertThreadHistoryToEvents(response.thread);
      const normalized = response.thread;

      set({ ...syncThreadToStore(threadId, normalized, historicalEvents, { resetCurrentTurnId: true }) });
      return normalized;
    } catch (error: unknown) {
      console.error('[CodexService] threadRollback error:', error);
      throw error;
    }
  },

  async turnStart(threadId: string, input: string, images: string[] = []) {
    const set = useCodexStore.setState;
    try {
      const userInputs: UserInput[] = [];

      if (input.trim()) {
        userInputs.push({ type: 'text', text: input, text_elements: [] });
      }

      for (const imagePath of images) {
        userInputs.push({ type: 'localImage', path: imagePath });
      }

      // If both are empty? Assuming input area checks this, but if so, send empty text?
      if (userInputs.length === 0) {
        userInputs.push({ type: 'text', text: '', text_elements: [] });
      }

      const { model, reasoningEffort, approvalPolicy, sandbox, webSearchRequest } =
        useConfigStore.getState();

      const response = await turnStart({
        threadId,
        input: userInputs,
        cwd: resolveThreadCwd(threadId),
        approvalPolicy,
        sandboxPolicy: sandboxModeToPolicy(sandbox, webSearchRequest),
        model: model || null,
        effort: reasoningEffort ?? null
      });

      const preview = getThreadPreviewFromInput(userInputs);
      set((state) => ({
        currentTurnId: response.turn.id,
        threads: state.threads.map((thread) => {
          if (thread.id !== threadId) {
            return thread;
          }
          if (thread.preview.trim() || !preview) {
            return thread;
          }
          return {
            ...thread,
            preview,
          };
        }),
      }));
      return response.turn;
    } catch (error: unknown) {
      console.error('[CodexService] turnStart error:', error);
      throw error;
    }
  },

  async turnInterrupt(threadId: string, turnId: string) {
    const set = useCodexStore.setState;
    try {
      await turnInterrupt({ threadId, turnId });
      set({ currentTurnId: null });
    } catch (error: unknown) {
      console.error('[CodexService] turnInterrupt error:', error);
      throw error;
    }
  },

  async listSkills(cwd: string | null) {
    if (!cwd) return [];
    try {
      const response = await skillList(cwd);
      console.log('[CodexService] listSkills response:', response.data);
      return response.data;
    } catch (error: unknown) {
      console.error('[CodexService] listSkills error:', error);
      throw error;
    }
  },
};
