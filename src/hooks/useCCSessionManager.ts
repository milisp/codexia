import { useCallback, useRef } from 'react';
import { fromSdkMessages } from '@/components/cc/utils/fromSdkMessages';
import { ccGetSessionMessages, ccNewSession, ccResumeSession, ccSendMessage } from '@/services';
import { gitCreateWorktree } from '@/services/apiAdapt/git';
import { type CCOptions, useCCStore } from '@/stores/cc';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { CcAgentOptionsPayload } from '@/types/cc/agentOptions';

const CC_LISTENER_READY_EVENT = 'cc-session-listener-ready';
const CC_PERMISSION_LISTENER_READY_EVENT = 'cc-permission-listener-ready';
const LISTENER_READY_TIMEOUT_MS = 400;

/**
 * Resolves once the listener for `eventName` reports readiness for `sessionId`,
 * or after `timeoutMs` as a safety net. Resolves with `false` when it timed out.
 */
function waitForListenerReady(
  eventName: string,
  sessionId: string,
  timeoutMs = LISTENER_READY_TIMEOUT_MS
): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(true);
      return;
    }

    let done = false;
    const finish = (ready: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener(eventName, handleReady as EventListener);
      clearTimeout(timer);
      resolve(ready);
    };

    const handleReady = (event: Event) => {
      const customEvent = event as CustomEvent<{ sessionId?: string }>;
      if (customEvent.detail?.sessionId === sessionId) {
        finish(true);
      }
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    window.addEventListener(eventName, handleReady as EventListener);
  });
}

/** Waits for both the message and permission listeners of a session. */
async function waitForListeners(sessionId: string): Promise<void> {
  // Let React flush the effects that bind the listeners for this session.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const [messageReady, permissionReady] = await Promise.all([
    waitForListenerReady(CC_LISTENER_READY_EVENT, sessionId),
    waitForListenerReady(CC_PERMISSION_LISTENER_READY_EVENT, sessionId),
  ]);

  if (!messageReady || !permissionReady) {
    console.warn('[useCCSessionManager] Listener readiness timed out', {
      sessionId,
      messageReady,
      permissionReady,
    });
  }
}

const OPTIONAL_OPTION_KEYS = [
  'fallbackModel',
  'maxTurns',
  'maxBudgetUsd',
  'maxThinkingTokens',
  'allowedTools',
  'disallowedTools',
] as const;

/** Builds the payload shared by `cc_new_session` and `cc_resume_session`. */
function buildAgentOptions(
  options: CCOptions,
  cwd: string,
  extra?: Partial<CcAgentOptionsPayload>
): CcAgentOptionsPayload {
  const payload: CcAgentOptionsPayload = {
    cwd,
    permissionMode: options.permissionMode,
    ...extra,
  };

  // Only include model/effort if specified (otherwise use CLI default)
  if (options.model) payload.model = options.model;
  if (options.effort) payload.effort = options.effort;

  for (const key of OPTIONAL_OPTION_KEYS) {
    const value = options[key];
    if (value !== undefined) {
      Object.assign(payload, { [key]: value });
    }
  }

  return payload;
}

/**
 * Custom hook for managing Claude Code sessions
 * Handles session creation, resumption, and selection
 */
export function useCCSessionManager() {
  // Select per field: subscribing to the whole store re-renders every consumer
  // of this hook on any CC state change (messages streaming in, etc.).
  const options = useCCStore((s) => s.options);
  const isLoading = useCCStore((s) => s.isLoading);
  const setActiveSessionId = useCCStore((s) => s.setActiveSessionId);
  const setMessages = useCCStore((s) => s.setMessages);
  const setConnected = useCCStore((s) => s.setConnected);
  const setLoading = useCCStore((s) => s.setLoading);
  const setShowExamples = useCCStore((s) => s.setShowExamples);
  const addMessage = useCCStore((s) => s.addMessage);
  const switchToSession = useCCStore((s) => s.switchToSession);
  const setSessionLoading = useCCStore((s) => s.setSessionLoading);
  const setPendingNewSession = useCCStore((s) => s.setPendingNewSession);
  const removeActiveSessionId = useCCStore((s) => s.removeActiveSessionId);
  const addAgentCard = useAgentCenterStore((s) => s.addAgentCard);
  const setCurrentAgentCardId = useAgentCenterStore((s) => s.setCurrentAgentCardId);

  // Guards against concurrent resume/select calls clobbering each other's state.
  const inFlightRef = useRef<string | null>(null);

  const handleNewSession = useCallback(
    async (initialMessage?: string) => {
      const cwd = useWorkspaceStore.getState().cwd;
      let createdSessionId: string | null = null;
      try {
        setCurrentAgentCardId(null);
        setLoading(true);

        // If no initial message, just reset UI without creating backend session
        // Session will be created when user sends first message
        if (!initialMessage) {
          setActiveSessionId(null);
          setMessages([]);
          setConnected(false);
          setShowExamples(false);
          return;
        }

        // Prepare worktree if enabled
        let sessionCwd = cwd;
        let sessionWorktreePath: string | undefined;
        if (options.worktreeMode === 'worktree' && cwd?.trim()) {
          try {
            const worktreeKey = `cc-${crypto.randomUUID()}`;
            const prepared = await gitCreateWorktree(cwd, worktreeKey);
            sessionCwd = prepared.worktree_path;
            sessionWorktreePath = prepared.worktree_path;
          } catch (err) {
            console.warn(
              '[useCCSessionManager] Failed to prepare worktree, falling back to cwd',
              err
            );
          }
        }

        if (!sessionCwd?.trim()) {
          console.error('[useCCSessionManager] Cannot create session without a working directory');
          return;
        }

        const claudeAgentOptions = buildAgentOptions(options, sessionCwd);
        console.debug('ClaudeAgentOptions', claudeAgentOptions);

        // Backend creates the session and returns a UUID. Set up all state first so
        // the listener is ready before the first message arrives.
        const sessionId = await ccNewSession(claudeAgentOptions);
        createdSessionId = sessionId;

        setActiveSessionId(sessionId);
        setMessages([]);
        setShowExamples(false);
        addMessage({ type: 'user', text: initialMessage });
        setConnected(true);
        setSessionLoading(sessionId, true);
        addAgentCard({
          kind: 'cc',
          id: sessionId,
          preview: initialMessage,
          worktreePath: sessionWorktreePath,
          cwd: sessionCwd,
        });
        setCurrentAgentCardId(sessionId);
        setPendingNewSession({
          session_id: sessionId,
          summary: initialMessage,
          last_modified: Date.now(),
          cwd: sessionCwd,
        });

        // Send the initial message only once the listeners are actually bound,
        // otherwise the first streamed events are dropped.
        await waitForListeners(sessionId);
        await ccSendMessage(sessionId, initialMessage);

        console.info('[useCCSessionManager] New session created', {
          sessionId,
          permissionMode: options.permissionMode,
        });
      } catch (error) {
        console.error('Failed to create new session:', error);
        setConnected(false);
        if (createdSessionId) setSessionLoading(createdSessionId, false);
      } finally {
        setLoading(false);
      }
    },
    [
      options,
      addAgentCard,
      addMessage,
      setActiveSessionId,
      setConnected,
      setCurrentAgentCardId,
      setLoading,
      setMessages,
      setPendingNewSession,
      setSessionLoading,
      setShowExamples,
    ]
  );

  const handleResumeSession = useCallback(
    async (sessionId: string, projectPath?: string) => {
      if (inFlightRef.current === sessionId) {
        console.info('[useCCSessionManager] Resume already in flight, ignoring', { sessionId });
        return;
      }
      inFlightRef.current = sessionId;

      const effectiveCwd = projectPath ?? useWorkspaceStore.getState().cwd;
      try {
        console.info('[useCCSessionManager] Resume session start', {
          sessionId,
          cwd: effectiveCwd,
        });

        if (!effectiveCwd?.trim()) {
          console.error('[useCCSessionManager] Cannot resume session without a working directory', {
            sessionId,
          });
          return;
        }

        // Keep the workspace in sync with the session being opened; the composer
        // and the CC view read cwd from the store, not from this call's argument.
        if (useWorkspaceStore.getState().cwd !== effectiveCwd) {
          useWorkspaceStore.getState().setCwd(effectiveCwd);
        }

        setLoading(true);
        setMessages([]);
        setShowExamples(false);

        // Set session ID FIRST to ensure event listener is set up
        setActiveSessionId(sessionId);

        // Restore the transcript: resuming only spawns the client, the backend
        // does not replay past messages over the event stream.
        try {
          const history = await ccGetSessionMessages(sessionId);
          setMessages(fromSdkMessages(history, sessionId));
        } catch (err) {
          console.warn('[useCCSessionManager] Failed to load session history', { sessionId, err });
        }

        // Wait for CC view listener readiness before replaying historical messages.
        await waitForListeners(sessionId);

        await ccResumeSession(
          sessionId,
          buildAgentOptions(options, effectiveCwd, {
            resume: sessionId,
            continueConversation: true,
          })
        );
        console.info('[useCCSessionManager] Resume session success', {
          sessionId,
          cwd: effectiveCwd,
        });

        // Session history loaded, but not connected yet
        // Connection will happen when user sends first message
        setConnected(false);
      } catch (error) {
        console.error('[useCCSessionManager] Failed to resume session', {
          sessionId,
          cwd: effectiveCwd,
          error,
        });
        setConnected(false);
        setSessionLoading(sessionId, false);
        // setActiveSessionId already registered this id as "active"; drop it so a
        // later click retries the resume instead of switching to an empty session.
        removeActiveSessionId(sessionId);
      } finally {
        inFlightRef.current = null;
        setLoading(false);
      }
    },
    [
      options,
      setActiveSessionId,
      setConnected,
      setLoading,
      setMessages,
      setSessionLoading,
      setShowExamples,
      removeActiveSessionId,
    ]
  );

  const handleSessionSelect = useCallback(
    async (sessionId: string, projectPath?: string) => {
      console.info('[useCCSessionManager] Session selected', { sessionId, cwd: projectPath });

      // If session is already active (in activeSessionIds), just switch to it — no backend resume needed
      const currentActiveSessionIds = useCCStore.getState().activeSessionIds;
      if (currentActiveSessionIds.includes(sessionId)) {
        console.info('[useCCSessionManager] Session already active, switching without resume', {
          sessionId,
        });
        if (projectPath && useWorkspaceStore.getState().cwd !== projectPath) {
          useWorkspaceStore.getState().setCwd(projectPath);
        }
        switchToSession(sessionId);
        return;
      }

      await handleResumeSession(sessionId, projectPath);
    },
    [handleResumeSession, switchToSession]
  );

  return {
    handleNewSession,
    handleResumeSession,
    handleSessionSelect,
    isLoading,
  };
}
