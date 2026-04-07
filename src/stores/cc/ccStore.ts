import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CCMessage } from '@/components/cc/types/messages';
import type { CCMcpServers } from '@/types/cc/cc-mcp';
import type { ThreadCwdMode } from '@/stores/codex/useConfigStore';
import type { SdkSessionInfo } from '@/lib/sessions';

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
export type ModelType = 'sonnet' | 'haiku' | 'opus';

export interface CCPluginConfig {
  path: string;
  name?: string;
}

export interface CCOptions {
  model?: ModelType;
  permissionMode: PermissionMode;
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  maxThinkingTokens?: number;
  fallbackModel?: string;
  maxBudgetUsd?: number;
  plugins?: CCPluginConfig[];
  // Note: enabledSkills removed - skills are auto-discovered by Claude Code CLI
  // from ~/.claude/skills/ and cannot be filtered per-session
  mcpServers?: CCMcpServers;
  worktreeMode?: ThreadCwdMode;
}

interface CCStoreState {
  activeSessionId: string | null;
  activeSessionIds: string[];
  messages: CCMessage[];
  sessionMessagesMap: Record<string, CCMessage[]>;
  /** Per-session loading state, tracks processing for each session independently */
  sessionLoadingMap: Record<string, boolean>;
  /** Timestamp (ms) when the first message arrived for each session */
  sessionStartTimeMap: Record<string, number>;
  options: CCOptions;
  isConnected: boolean;
  isLoading: boolean;
  showExamples: boolean;
  /** Slash commands available in the current session (populated from System::init) */
  slashCommands: string[];
  /** Newly created session not yet reflected in the backend session list */
  pendingNewSession: SdkSessionInfo | null;

  setActiveSessionId: (id: string | null) => void;
  addActiveSessionId: (id: string) => void;
  removeActiveSessionId: (id: string) => void;
  switchToSession: (id: string) => void;
  saveCurrentSessionMessages: () => void;
  addMessage: (message: CCMessage) => void;
  /** Add a message to a specific session's map regardless of which session is active */
  addMessageToSession: (sessionId: string, message: CCMessage) => void;
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  updateMessage: (index: number, message: Partial<CCMessage>) => void;
  updateSessionMessage: (sessionId: string, index: number, message: Partial<CCMessage>) => void;
  setMessages: (messages: CCMessage[]) => void;
  updateOptions: (options: Partial<CCOptions>) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setShowExamples: (show: boolean) => void;
  clearMessages: () => void;
  setSlashCommands: (commands: string[]) => void;
  setPendingNewSession: (session: SdkSessionInfo | null) => void;
}

export const useCCStore = create<CCStoreState>()(
  persist(
    (set) => ({
      activeSessionId: null,
      activeSessionIds: [],
      messages: [],
      sessionMessagesMap: {},
      sessionLoadingMap: {},
      sessionStartTimeMap: {},
      options: {
        model: undefined,
        permissionMode: 'default',
      },
      isConnected: false,
      isLoading: false,
      showExamples: true,
      slashCommands: [],
      pendingNewSession: null,

      setActiveSessionId: (id) =>
        set((state) => {
          const newIds =
            id && !state.activeSessionIds.includes(id)
              ? [...state.activeSessionIds, id]
              : state.activeSessionIds;
          return { activeSessionId: id, activeSessionIds: newIds };
        }),
      addActiveSessionId: (id) =>
        set((state) => ({
          activeSessionIds: state.activeSessionIds.includes(id)
            ? state.activeSessionIds
            : [...state.activeSessionIds, id],
        })),
      removeActiveSessionId: (id) =>
        set((state) => ({
          activeSessionIds: state.activeSessionIds.filter((sid) => sid !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        })),
      // Save current session's messages to the map, then switch to target session and restore its messages
      switchToSession: (id) =>
        set((state) => {
          const updatedMap = { ...state.sessionMessagesMap };
          // Persist current session messages before switching
          if (state.activeSessionId) {
            updatedMap[state.activeSessionId] = state.messages;
          }
          const restoredMessages = updatedMap[id] ?? [];
          return {
            activeSessionId: id,
            sessionMessagesMap: updatedMap,
            messages: restoredMessages,
            isLoading: false,
            isConnected: true,
          };
        }),
      // Persist current session messages to map without switching
      saveCurrentSessionMessages: () =>
        set((state) => {
          if (!state.activeSessionId) return {};
          return {
            sessionMessagesMap: {
              ...state.sessionMessagesMap,
              [state.activeSessionId]: state.messages,
            },
          };
        }),
      addMessage: (message) =>
        set((state) => {
          const sid = state.activeSessionId;
          const newMessages = [...state.messages, message];
          const isDone = message.type === 'result';
          const updatedMap = sid
            ? { ...state.sessionMessagesMap, [sid]: newMessages }
            : state.sessionMessagesMap;
          const loadingUpdate = sid
            ? { sessionLoadingMap: { ...state.sessionLoadingMap, [sid]: !isDone } }
            : {};
          let startTimeUpdate: { sessionStartTimeMap?: Record<string, number> } = {};
          if (sid) {
            if (isDone) {
              const { [sid]: _, ...rest } = state.sessionStartTimeMap;
              startTimeUpdate = { sessionStartTimeMap: rest };
            } else if (!state.sessionStartTimeMap[sid]) {
              startTimeUpdate = { sessionStartTimeMap: { ...state.sessionStartTimeMap, [sid]: Date.now() } };
            }
          }
          return { messages: newMessages, isLoading: !isDone, sessionMessagesMap: updatedMap, ...loadingUpdate, ...startTimeUpdate };
        }),
      addMessageToSession: (sessionId, message) =>
        set((state) => {
          const prev = state.sessionMessagesMap[sessionId] ?? [];
          const updated = [...prev, message];
          const isDone = message.type === 'result';
          const isActive = state.activeSessionId === sessionId;
          // Track the start of each processing cycle:
          // - Clear on result so the next cycle gets a fresh timestamp.
          // - Set on the first non-result message when no start is recorded.
          let startTimeUpdate: { sessionStartTimeMap?: Record<string, number> } = {};
          if (isDone) {
            const { [sessionId]: _, ...rest } = state.sessionStartTimeMap;
            startTimeUpdate = { sessionStartTimeMap: rest };
          } else if (!state.sessionStartTimeMap[sessionId]) {
            startTimeUpdate = { sessionStartTimeMap: { ...state.sessionStartTimeMap, [sessionId]: Date.now() } };
          }
          return {
            sessionMessagesMap: { ...state.sessionMessagesMap, [sessionId]: updated },
            sessionLoadingMap: { ...state.sessionLoadingMap, [sessionId]: !isDone },
            ...startTimeUpdate,
            ...(isActive ? { messages: updated, isLoading: !isDone } : {}),
          };
        }),
      setSessionLoading: (sessionId, loading) =>
        set((state) => ({
          sessionLoadingMap: { ...state.sessionLoadingMap, [sessionId]: loading },
          ...(state.activeSessionId === sessionId ? { isLoading: loading } : {}),
        })),
      updateMessage: (index, message) =>
        set((state) => {
          const updatedMessages = state.messages.map((m, i) =>
            i === index ? { ...m, ...message } as CCMessage : m
          );
          const updatedMap = state.activeSessionId
            ? { ...state.sessionMessagesMap, [state.activeSessionId]: updatedMessages }
            : state.sessionMessagesMap;
          return { messages: updatedMessages, sessionMessagesMap: updatedMap };
        }),
      updateSessionMessage: (sessionId, index, message) =>
        set((state) => {
          const sessionMsgs = state.sessionMessagesMap[sessionId] ?? [];
          const updated = sessionMsgs.map((m, i) =>
            i === index ? { ...m, ...message } as CCMessage : m
          );
          const updatedMap = { ...state.sessionMessagesMap, [sessionId]: updated };
          // Also sync global messages if this session is active.
          const isActive = state.activeSessionId === sessionId;
          return { sessionMessagesMap: updatedMap, ...(isActive ? { messages: updated } : {}) };
        }),
      setMessages: (messages) => set({ messages }),
      updateOptions: (newOptions) =>
        set((state) => ({
          options: { ...state.options, ...newOptions },
        })),
      setConnected: (connected) => set({ isConnected: connected }),
      setLoading: (loading) => set({ isLoading: loading }),
      setShowExamples: (show) => set({ showExamples: show }),
      clearMessages: () => set({ messages: [] }),
      setSlashCommands: (commands) => set({ slashCommands: commands }),
      setPendingNewSession: (session) => set({ pendingNewSession: session }),
    }),
    {
      name: 'cc-store',
      version: 2,
      partialize: (state) => ({
        options: state.options,
        slashCommands: state.slashCommands,
      }),
    }
  )
);
