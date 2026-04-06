import { useEffect, useMemo, useRef } from 'react';
import { useCCSessionListener, useCCPermissionListener } from './hooks';

import { useCCStore } from '@/stores/cc';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ccGetSessionFilePath, ccResumeSession } from '@/services/tauri/cc';
import { readTextFileLines } from '@/services/tauri/filesystem';
import { parseSessionJsonl } from './utils/parseSessionJsonl';

import { CCMessage } from '@/components/cc/messages';
import { PermissionRequestCard } from '@/components/cc/messages/PermissionRequestCard';
import { Composer } from '@/components/cc/composer/Composer';
import { CCScrollControls } from '@/components/cc/CCScrollControls';
import { buildMessageGroups, CCExploredMessageGroup } from './messages/group';
import { buildInlineErrorsMap } from './messages/inlineErrors';
import type { PermissionRequestMessage } from './types/messages';
import type { PermissionDecision } from './types/permission';


interface CCViewProps {
  /** When provided, renders in embedded (grid-card) mode for this specific session. */
  sessionId?: string;
  /** Suppress the internal composer (e.g. when a parent renders its own composer). */
  hideComposer?: boolean;
  /**
   * Disable the internal event listeners. Use when a sibling standalone CCView
   * is already listening to the same session to prevent double-writing messages.
   */
  disableListener?: boolean;
}

export default function CCView({ sessionId, hideComposer = false, disableListener = false }: CCViewProps = {}) {
  const isEmbedded = !!sessionId;

  const {
    activeSessionId,
    activeSessionIds,
    addActiveSessionId,
    messages: globalMessages,
    sessionMessagesMap,
    sessionLoadingMap,
    isLoading: globalIsLoading,
    setLoading,
    setConnected,
    clearMessages,
    options,
    updateMessage,
    updateSessionMessage,
    addMessageToSession,
    setSessionLoading,
  } = useCCStore();
  const { cwd } = useWorkspaceStore();

  // In embedded mode use per-session data; otherwise use the global active-session data.
  const messages = isEmbedded ? (sessionMessagesMap[sessionId!] ?? []) : globalMessages;
  const isLoading = isEmbedded ? (sessionLoadingMap[sessionId!] ?? false) : globalIsLoading;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);

  // Reset transient UI state when directory changes (standalone mode only).
  useEffect(() => {
    if (isEmbedded || !cwd || activeSessionId) return;
    clearMessages();
    setConnected(false);
    setLoading(false);
  }, [cwd, activeSessionId, clearMessages, setConnected, setLoading, isEmbedded]);

  // Auto-resume when entering full-screen for a session not yet active (standalone only).
  useEffect(() => {
    if (isEmbedded) return;
    if (!activeSessionId || activeSessionIds.includes(activeSessionId) || !cwd) return;
    const sid = activeSessionId;
    void (async () => {
      const filePath = await ccGetSessionFilePath(sid);
      if (filePath) {
        const lines = await readTextFileLines(filePath);
        for (const msg of parseSessionJsonl(lines, sid)) {
          addMessageToSession(sid, msg);
        }
        setSessionLoading(sid, false);
      }
      await ccResumeSession(sid, {
        cwd,
        permissionMode: options.permissionMode,
        resume: sid,
        continueConversation: true,
        ...(options.model ? { model: options.model } : {}),
      });
      addActiveSessionId(sid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, isEmbedded]);

  // Track user scroll intent.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Smooth-scroll to bottom when messages update.
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    isProgrammaticScrollRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    const timer = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      if (el) {
        shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const inlineErrorsMap = useMemo(
    () => buildInlineErrorsMap(messages),
    [messages],
  );

  const messageGroups = useMemo(
    () => buildMessageGroups(messages),
    [messages],
  );

  const pendingPermissionIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === 'permission_request' && !m.resolved) return i;
    }
    return -1;
  }, [messages]);

  const handleResolvePermission = async (requestId: string, decision: PermissionDecision) => {
    const { ccResolvePermission } = await import('@/services');
    try {
      await ccResolvePermission(requestId, decision);
      if (isEmbedded && sessionId) {
        updateSessionMessage(sessionId, pendingPermissionIdx, { resolved: decision } as any);
      } else {
        updateMessage(pendingPermissionIdx, { resolved: decision } as any);
      }
    } catch (err) {
      console.error('Failed to resolve permission:', err);
    }
  };

  useCCSessionListener({ sessionId, disabled: disableListener });
  useCCPermissionListener({ sessionId, disabled: disableListener });

  return (
    <div className="flex flex-col h-full min-h-0 w-full max-w-4xl mx-auto">
      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:display-none"
        >
          <div className="flex flex-col gap-2 p-4">

            {/* Message list */}
            {messageGroups.map((group) =>
              group.kind === 'explored' ? (
                <CCExploredMessageGroup
                  key={`explored-${group.msgIndices[0]}`}
                  msgIndices={group.msgIndices}
                  messages={messages}
                  inlineErrorsMap={inlineErrorsMap}
                />
              ) : (
                <CCMessage
                  key={group.msgIdx}
                  message={messages[group.msgIdx]}
                  index={group.msgIdx}
                  inlineErrors={inlineErrorsMap[group.msgIdx]}
                />
              )
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="text-xs text-muted-foreground animate-pulse">Thinking</div>
            )}
          </div>
        </div>

        {!isEmbedded && messages.length > 0 && (
          <CCScrollControls scrollContainerRef={scrollContainerRef} />
        )}
      </div>

      {pendingPermissionIdx !== -1 && (
        <PermissionRequestCard
          msg={messages[pendingPermissionIdx] as PermissionRequestMessage}
          onResolve={handleResolvePermission}
        />
      )}
      {!isEmbedded && !hideComposer && pendingPermissionIdx === -1 && <Composer />}
    </div>
  );
}
