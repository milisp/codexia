import {
  threadFork,
  threadRollback,
  threadStart,
  threadResume,
  turnStart,
  turnInterrupt,
  threadList,
  threadArchive,
  skillList,
  skillsConfigWrite as tauriSkillsConfigWrite,
  loginChatGpt as tauriLoginChatGpt,
  getAccount as tauriGetAccount,
  reviewStart,
  gitCreateWorktree,
} from './tauri';
import type {
  Thread,
  ThreadForkParams,
  ThreadStartParams,
  ThreadListParams,
  ThreadRollbackParams,
  UserInput,
  ReviewStartParams,
  SandboxMode,
  SandboxPolicy,
  ReadOnlyAccess,
} from '@/bindings/v2';
import type { CollaborationMode } from '@/bindings';
import type { ThreadListItem } from '@/types/codex/ThreadListItem';
import { useCodexStore, useConfigStore, type ModeKind } from '@/stores/codex';
import { useWorkspaceStore } from '@/stores';
import { convertThreadHistoryToEvents } from '@/utils/threadHistoryConverter';
import { getErrorMessage } from '@/utils/errorUtils';

const sandboxModeToPolicy = (mode: SandboxMode, networkAccess: boolean): SandboxPolicy => {
  const fullReadOnlyAccess: ReadOnlyAccess = { type: 'fullAccess' };
  switch (mode) {
    case 'read-only':
      return { type: 'readOnly', access: fullReadOnlyAccess, networkAccess };
    case 'workspace-write':
      return {
        type: 'workspaceWrite',
        writableRoots: [],
        readOnlyAccess: fullReadOnlyAccess,
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

const isExperimentalRawEventsCapabilityError = (error: unknown): boolean =>
  getErrorMessage(error).includes('experimentalRawEvents requires experimentalApi capability');

type ThreadLike = Thread & { updatedAt?: number };
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

const threadSourceToString = (source: ThreadLike['source']): string => {
  if (typeof source === 'string') {
    return source;
  }
  if (!source) {
    return '';
  }
  return JSON.stringify(source);
};

export const codexService = {
  normalizeThreadItem(thread: ThreadLike): ThreadListItem {
    const createdAt = thread.createdAt ?? 0;
    const updatedAt = thread.updatedAt ?? 0;
    return {
      id: thread.id,
      preview: thread.preview ?? '',
      cwd: thread.cwd ?? '',
      path: thread.path ?? '',
      source: threadSourceToString(thread.source),
      createdAt,
      updatedAt,
    };
  },
  async loadThreads(
    cwd: string,
    archived: boolean = false,
    sortKey: 'created_at' | 'updated_at' = 'updated_at'
  ) {
    try {
      const params: ThreadListParams = {
        cursor: null,
        limit: 20,
        modelProviders: null,
      };
      const response = await threadList(
        {
          ...params,
          sortKey,
          archived,
          sourceKinds: null,
        } as ThreadListParams,
        cwd
      );
      console.log('[CodexService] listThreads response:', response);
      const workingDirThreads = response.data.map((t) => codexService.normalizeThreadItem(t));
      const nextCursor =
        (response as { nextCursor?: string | null }).nextCursor ??
        (response as { next_cursor?: string | null }).next_cursor ??
        null;
      const { setThreads, setThreadListNextCursor } = useCodexStore.getState();
      setThreads(workingDirThreads);
      setThreadListNextCursor(nextCursor);
    } catch (error: unknown) {
      console.error('[CodexService] Failed to load threads:', error);
      useCodexStore.getState().setThreadListNextCursor(null);
      useCodexStore.getState().setThreads([]);
    }
  },
  async loadMoreThreads(cwd: string, sortKey: 'created_at' | 'updated_at' = 'updated_at') {
    const { threadListNextCursor, appendThreads, setThreadListNextCursor } =
      useCodexStore.getState();
    if (!threadListNextCursor) {
      return;
    }
    try {
      const params: ThreadListParams = {
        cursor: threadListNextCursor,
        limit: 20,
        modelProviders: null,
      };
      const response = await threadList(
        {
          ...params,
          sortKey,
          archived: false,
          sourceKinds: null,
        } as ThreadListParams,
        cwd
      );
      console.log('[CodexService] listThreads (nextCursor) response:', response);
      const workingDirThreads = response.data.map((t) => codexService.normalizeThreadItem(t));
      const nextCursor =
        (response as { nextCursor?: string | null }).nextCursor ??
        (response as { next_cursor?: string | null }).next_cursor ??
        null;
      appendThreads(workingDirThreads);
      setThreadListNextCursor(nextCursor);
    } catch (error: unknown) {
      console.error('[CodexService] Failed to load more threads:', error);
      setThreadListNextCursor(null);
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
    const set = useCodexStore.setState;
    const shouldResume = options?.resume ?? true;
    try {
      if (!threadId) {
        set((state) => ({
          currentThreadId: null,
          currentTurnId: null,
          inputFocusTrigger: state.inputFocusTrigger + 1,
        }));
        return;
      }

      if (!shouldResume) {
        set((state) => ({
          currentThreadId: threadId,
          currentTurnId: null,
          inputFocusTrigger: state.inputFocusTrigger + 1,
        }));
        return;
      }

      const { activeThreadIds, events } = useCodexStore.getState();

      if (!activeThreadIds.includes(threadId) || !events[threadId]) {
        // Optimistically set currentThreadId before the async resume so ChatInterface
        // renders with the correct (empty) event list instead of a stale thread's state.
        set((state) => ({
          currentThreadId: threadId,
          currentTurnId: null,
          inputFocusTrigger: state.inputFocusTrigger + 1,
        }));
        await codexService.threadResume(threadId);
      } else {
        // Derive the active turn ID from the thread's live events so the Stop button
        // works correctly when the thread is still processing.
        const threadEvents = events[threadId] ?? [];
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
      }
    } catch (error: unknown) {
      console.error('[CodexService] setCurrentThread error:', error);
      throw error;
    }
  },

  async threadStart() {
    const set = useCodexStore.setState;
    try {
      const { model, modelProvider, approvalPolicy, sandbox, reasoningEffort, webSearchRequest, threadCwdMode } =
        useConfigStore.getState();
      const { cwd } = useWorkspaceStore.getState();
      let threadCwd = cwd;
      if (threadCwdMode === 'worktree' && cwd.trim()) {
        try {
          const prepared = await gitCreateWorktree(cwd, generateWorktreeKey());
          threadCwd = prepared.worktree_path;
        } catch (error) {
          console.warn('[CodexService] Failed to prepare thread worktree, fallback to workspace cwd', error);
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
          show_raw_agent_reasoning: true,
          model_reasoning_summary: 'auto',
          web_search_request: webSearchRequest,
          view_image_tool: true,
          'features.multi_agents': true,
        },
        experimentalRawEvents: true,
        persistExtendedHistory: true,
      };
      let response;
      try {
        response = await threadStart(params);
      } catch (error) {
        if (!isExperimentalRawEventsCapabilityError(error)) {
          throw error;
        }

        // Fallback for servers that do not expose experimental API capability.
        response = await threadStart({
          ...params,
          experimentalRawEvents: false,
        });
      }
      const thread = codexService.normalizeThreadItem(response.thread);

      set((state) => ({
        threads: [thread, ...state.threads],
        currentThreadId: thread.id,
        activeThreadIds: [...state.activeThreadIds, thread.id],
        events: { ...state.events, [thread.id]: [] },
        inputFocusTrigger: state.inputFocusTrigger + 1,
      }));

      console.log('[CodexService] threadStart completed successfully');
      return thread;
    } catch (error: unknown) {
      console.error('[CodexService] threadStart error:', error);
      throw error;
    }
  },

  async threadResume(threadId: string) {
    const set = useCodexStore.setState;
    const { activeThreadIds, events } = useCodexStore.getState();
    const { model, modelProvider } = useConfigStore.getState();
    try {
      const resumeCwd = resolveThreadCwd(threadId);
      const response = await threadResume({
        threadId,
        history: null,
        path: null,
        model: model || null,
        modelProvider: modelProvider || null,
        cwd: resumeCwd,
        approvalPolicy: null,
        sandbox: null,
        config: null,
        baseInstructions: null,
        developerInstructions: null,
        persistExtendedHistory: true,
      });
      console.log(response.thread.turns);

      const historicalEvents = convertThreadHistoryToEvents(response.thread);
      const normalized = codexService.normalizeThreadItem(response.thread);

      set((state) => ({
        currentThreadId: threadId,
        activeThreadIds: activeThreadIds.includes(threadId)
          ? activeThreadIds
          : [...activeThreadIds, threadId],
        threads: state.threads.some((thread) => thread.id === threadId)
          ? state.threads.map((thread) => (thread.id === threadId ? normalized : thread))
          : [normalized, ...state.threads],
        events: {
          ...events,
          [threadId]: historicalEvents,
        },
        inputFocusTrigger: state.inputFocusTrigger + 1,
      }));
    } catch (error: unknown) {
      console.error('[CodexService] threadResume error:', error);
      throw error;
    }
  },

  async threadFork(threadId: string) {
    const set = useCodexStore.setState;
    try {
      const {
        model,
        modelProvider,
        approvalPolicy,
        sandbox,
        reasoningEffort,
        webSearchRequest,
      } = useConfigStore.getState();
      const params: ThreadForkParams = {
        threadId,
        path: null,
        model,
        modelProvider,
        cwd: resolveThreadCwd(threadId),
        approvalPolicy,
        sandbox,
        config: {
          model_reasoning_effort: reasoningEffort,
          show_raw_agent_reasoning: true,
          model_reasoning_summary: 'auto',
          web_search_request: webSearchRequest,
          view_image_tool: true,
          'features.multi_agents': true,
        },
        baseInstructions: null,
        developerInstructions: null,
        persistExtendedHistory: true,
      };
      const response = await threadFork(params);
      const forkedThreadId = response.thread.id;
      const historicalEvents = convertThreadHistoryToEvents(response.thread);
      const normalized = codexService.normalizeThreadItem(response.thread);

      set((state) => ({
        currentThreadId: forkedThreadId,
        currentTurnId: null,
        activeThreadIds: state.activeThreadIds.includes(forkedThreadId)
          ? state.activeThreadIds
          : [...state.activeThreadIds, forkedThreadId],
        threads: state.threads.some((thread) => thread.id === forkedThreadId)
          ? state.threads.map((thread) => (thread.id === forkedThreadId ? normalized : thread))
          : [normalized, ...state.threads],
        events: {
          ...state.events,
          [forkedThreadId]: historicalEvents,
        },
        inputFocusTrigger: state.inputFocusTrigger + 1,
      }));
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
      const normalized = codexService.normalizeThreadItem(response.thread);

      set((state) => ({
        currentThreadId: threadId,
        currentTurnId: null,
        activeThreadIds: state.activeThreadIds.includes(threadId)
          ? state.activeThreadIds
          : [...state.activeThreadIds, threadId],
        threads: state.threads.some((thread) => thread.id === threadId)
          ? state.threads.map((thread) => (thread.id === threadId ? normalized : thread))
          : [normalized, ...state.threads],
        events: {
          ...state.events,
          [threadId]: historicalEvents,
        },
        inputFocusTrigger: state.inputFocusTrigger + 1,
      }));
      return normalized;
    } catch (error: unknown) {
      console.error('[CodexService] threadRollback error:', error);
      throw error;
    }
  },

  async turnStart(
    threadId: string,
    input: string,
    images: string[] = [],
    collaborationModeOverride?: ModeKind
  ) {
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

      const { model, reasoningEffort, approvalPolicy, sandbox, webSearchRequest, collaborationMode } =
        useConfigStore.getState();

      const effectiveMode = collaborationModeOverride ?? collaborationMode;
      const collaborationModeParam: CollaborationMode = {
        mode: effectiveMode,
        settings: {
          model: model || '',
          reasoning_effort: reasoningEffort ?? null,
          developer_instructions: null,
        },
      };

      const response = await turnStart({
        threadId,
        input: userInputs,
        cwd: resolveThreadCwd(threadId),
        approvalPolicy,
        sandboxPolicy: sandboxModeToPolicy(sandbox, webSearchRequest),
        model: model || null,
        effort: reasoningEffort ?? null,
        summary: null,
        outputSchema: null,
        collaborationMode: collaborationModeParam,
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

  async listSkills(cwd: string) {
    try {
      const response = await skillList(cwd);
      console.log('[CodexService] listSkills response:', response.data);
      return response.data;
    } catch (error: unknown) {
      console.error('[CodexService] listSkills error:', error);
      throw error;
    }
  },
  async skillsConfigWrite(path: string, enabled: boolean) {
    try {
      const response = await tauriSkillsConfigWrite(path, enabled);
      console.log('[CodexService] skillsConfigWrite response:', response);
      return response;
    } catch (error: unknown) {
      console.error('[CodexService] skillsConfigWrite error:', error);
      throw error;
    }
  },
  async loginChatGpt() {
    try {
      const response = await tauriLoginChatGpt();
      console.log('[CodexService] loginChatGpt response:', response);
      return response;
    } catch (error: unknown) {
      console.error('[CodexService] loginChatGpt error:', error);
      throw error;
    }
  },
  async getAccount() {
    try {
      const response = await tauriGetAccount();
      console.log('[CodexService] getAccount response:', response);
      return response;
    } catch (error: unknown) {
      console.error('[CodexService] getAccount error:', error);
      throw error;
    }
  },
  async startReview(params: ReviewStartParams) {
    try {
      const response = await reviewStart(params);
      console.log('[CodexService] startReview response:', response);
      return response;
    } catch (error: unknown) {
      console.error('[CodexService] startReview error:', error);
      throw error;
    }
  },
};
