import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { ChatMessage, CodexEvent, ApprovalRequest } from '@/types/codex';
import { useConversationStore } from '../stores/ConversationStore';

interface UseCodexEventsProps {
  sessionId: string;
  onApprovalRequest: (request: ApprovalRequest) => void;
}

export const useCodexEvents = ({ 
  sessionId, 
  onApprovalRequest
}: UseCodexEventsProps) => {
  const { addMessage, updateLastMessage, updateLastMessageReasoning, updateLastMessageToolOutput, setSessionLoading, createConversation, snapshotConversations } = useConversationStore();
  const DEBUG = (import.meta as any)?.env?.DEV && (window as any)?.__CODEX_DEBUG === true;

  // Buffer for streaming answer deltas with coalesced flushing
  const bufferRef = useRef<string>('');
  const flushTimerRef = useRef<any>(null);      // hard flush (post-boost)
  const softFlushTimerRef = useRef<any>(null);  // soft flush (post-boost)
  const answerSpoolerRef = useRef<any>(null);   // interval-based spooler
  // Adaptive smoothing defaults (used before rate is learned)
  const DEFAULT_MIN_CHUNK = 12;
  const FRAME_TARGET_MS = 32; // target UI frame pacing
  // Timer tunables for answer smoothing
  const MIN_FLUSH_MS = 16;
  const MAX_SOFT_MS = 120;
  const MAX_HARD_MS = 320;

  // Track incoming rate to adapt chunk sizes and waits
  const answerStatsRef = useRef<{ started: boolean; lastDeltaAt: number; lastFlushAt: number; ewmaInterMs: number; ewmaRateCps: number }>(
    { started: false, lastDeltaAt: 0, lastFlushAt: 0, ewmaInterMs: 0, ewmaRateCps: 0 }
  );
  const answerStartTsRef = useRef<number>(0);
  const INITIAL_BOOST_MS = 4000; // boost for first ~4s

  const hasWordBoundary = (s: string) => /[\s\.!?,;:\n]/.test(s);

  const updateAnswerStats = (deltaLen: number) => {
    const now = Date.now();
    const stats = answerStatsRef.current;
    if (stats.lastDeltaAt > 0) {
      const inter = Math.max(1, now - stats.lastDeltaAt);
      const instantRate = (deltaLen / inter) * 1000; // chars per second
      stats.ewmaInterMs = stats.ewmaInterMs ? (stats.ewmaInterMs * 0.7 + inter * 0.3) : inter;
      stats.ewmaRateCps = stats.ewmaRateCps ? (stats.ewmaRateCps * 0.7 + instantRate * 0.3) : instantRate;
    }
    stats.lastDeltaAt = now;
  };

  const computeDesiredChunk = () => {
    const rate = answerStatsRef.current.ewmaRateCps || 0;
    if (rate <= 0) return DEFAULT_MIN_CHUNK;
    const chunk = Math.round((rate * FRAME_TARGET_MS) / 1000);
    return Math.max(DEFAULT_MIN_CHUNK, Math.min(256, chunk));
  };

  const computeWaits = () => {
    const inter = answerStatsRef.current.ewmaInterMs || 40;
    const soft = Math.max(MIN_FLUSH_MS, Math.min(MAX_SOFT_MS, Math.round(inter * 1.1)));
    const hard = Math.max(80, Math.min(MAX_HARD_MS, soft * 3));
    return { soft, hard };
  };

  const resetAnswerStats = () => {
    answerStatsRef.current = { started: false, lastDeltaAt: 0, lastFlushAt: 0, ewmaInterMs: 0, ewmaRateCps: 0 };
    if (softFlushTimerRef.current) { clearTimeout(softFlushTimerRef.current); softFlushTimerRef.current = null; }
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    bufferRef.current = '';
    answerStartTsRef.current = 0;
    if (answerSpoolerRef.current) { clearInterval(answerSpoolerRef.current); answerSpoolerRef.current = null; }
  };

  // Buffer tool/exec output to avoid per-chunk re-render jank
  const toolBufferRef = useRef<string>('');
  const toolRafIdRef = useRef<number | null>(null);
  const flushToolBuffer = (finalize: boolean = false) => {
    if (!toolBufferRef.current) return;
    const state = useConversationStore.getState();
    const conv = state.conversations.find(c => c.id === sessionId);
    const msgs = conv?.messages || [];
    const last = msgs[msgs.length - 1] as any;
    const prev = (last?.toolOutput as string) || '';
    const chunk = toolBufferRef.current;
    toolBufferRef.current = '';
    updateLastMessageToolOutput(sessionId, prev + chunk, { isStreaming: !finalize });
  };
  const scheduleToolFlush = () => {
    if (toolRafIdRef.current != null) return;
    toolRafIdRef.current = requestAnimationFrame(() => {
      toolRafIdRef.current = null;
      flushToolBuffer(false);
    });
  };
  const resetToolBuffer = () => {
    if (toolRafIdRef.current != null) { cancelAnimationFrame(toolRafIdRef.current); toolRafIdRef.current = null; }
    toolBufferRef.current = '';
  };

  const flushBuffer = (forced: boolean = false) => {
    const buf = bufferRef.current;
    if (!buf) return;
    const desired = computeDesiredChunk();
    if (!forced && buf.length < desired && !hasWordBoundary(buf)) {
      return;
    }
    const state = useConversationStore.getState();
    const conv = state.conversations.find(c => c.id === sessionId);
    const msgs = conv?.messages || [];
    const last = msgs[msgs.length - 1] as any;
    const newContent = ((last?.content as string) || '') + buf;
    updateLastMessage(sessionId, newContent, { isStreaming: true });
    bufferRef.current = '';
    answerStatsRef.current.lastFlushAt = Date.now();
    if (softFlushTimerRef.current) { clearTimeout(softFlushTimerRef.current); softFlushTimerRef.current = null; }
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
  };

  // Timer-based scheduling for answers with early boost + interval spooler
  const scheduleFlush = () => {
    const stats = answerStatsRef.current;
    const now = Date.now();
    const inBoost = answerStartTsRef.current > 0 && (now - answerStartTsRef.current) < INITIAL_BOOST_MS;

    // On the very first delta, start clock and flush immediately
    if (!stats.started) {
      stats.started = true;
      answerStartTsRef.current = now;
      // Start interval spooler to guarantee forward progress regardless of timer jitter
      if (!answerSpoolerRef.current) {
        answerSpoolerRef.current = setInterval(() => {
          if (!bufferRef.current || bufferRef.current.length === 0) return;
          // Take a modest chunk to keep UI responsive; scale with backlog
          const backlog = bufferRef.current.length;
          let take = Math.max(8, Math.min(96, Math.round((answerStatsRef.current.ewmaRateCps || 120) * FRAME_TARGET_MS / 1000)));
          if (backlog > 400) take = Math.min(192, take * 3);
          else if (backlog > 200) take = Math.min(144, take * 2);
          const out = bufferRef.current.slice(0, take);
          bufferRef.current = bufferRef.current.slice(take);
          const state = useConversationStore.getState();
          const conv = state.conversations.find(c => c.id === sessionId);
          const msgs = conv?.messages || [];
          const last = msgs[msgs.length - 1] as any;
          const newContent = ((last?.content as string) || '') + out;
          updateLastMessage(sessionId, newContent, { isStreaming: true });
        }, 33); // ~30fps
      }
      // Microflush to show first tokens now
      setTimeout(() => flushBuffer(true), 0);
      return;
    }

    // During boost window, flush aggressively to avoid perceived lag
    if (inBoost) {
      setTimeout(() => flushBuffer(true), 0);
      return;
    }

    // After boost, adaptive chunking and waits
    const desired = computeDesiredChunk();
    const { soft, hard } = computeWaits();

    if (bufferRef.current.length >= desired) {
      const sinceLast = now - (answerStatsRef.current.lastFlushAt || 0);
      const delay = Math.max(0, MIN_FLUSH_MS - sinceLast);
      if (delay === 0) {
        flushBuffer();
      } else {
        if (softFlushTimerRef.current) clearTimeout(softFlushTimerRef.current);
        softFlushTimerRef.current = setTimeout(() => flushBuffer(), delay);
      }
    } else {
      if (softFlushTimerRef.current) clearTimeout(softFlushTimerRef.current);
      softFlushTimerRef.current = setTimeout(() => flushBuffer(), soft);

      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => flushBuffer(true), hard);
    }
  };

  // scheduleFlush: no longer used (rAF streaming); kept for reference

  // Separate buffer for reasoning deltas with smoothing
  const reasoningBufferRef = useRef<string>('');
  const reasoningFlushTimerRef = useRef<any>(null);    // legacy hard flush (finalize)
  const reasoningRevealTimerRef = useRef<any>(null);   // deprecated timer loop
  const reasoningRafIdRef = useRef<number | null>(null); // requestAnimationFrame loop
  // const isPunct = (c: string) => /[\.!?,;:\n]/.test(c);

  // Adaptive pacing for reasoning reveal
  const reasoningStatsRef = useRef<{ lastDeltaAt: number; ewmaRateCps: number }>(
    { lastDeltaAt: 0, ewmaRateCps: 0 }
  );
  const updateReasoningStats = (deltaLen: number) => {
    const now = Date.now();
    const stats = reasoningStatsRef.current;
    if (stats.lastDeltaAt > 0) {
      const inter = Math.max(1, now - stats.lastDeltaAt);
      const instantRate = (deltaLen / inter) * 1000;
      stats.ewmaRateCps = stats.ewmaRateCps ? (stats.ewmaRateCps * 0.7 + instantRate * 0.3) : instantRate;
    }
    stats.lastDeltaAt = now;
  };
  // Deprecated: rAF pacing now handles delays; kept for reference to avoid rework.
  // const computeReasoningDelay = (_ch: string) => {
  //   const rate = Math.max(10, Math.min(300, reasoningStatsRef.current.ewmaRateCps || 120));
  //   const base = Math.max(3, Math.min(24, Math.round(1000 / rate)));
  //   return base;
  // };

  const flushReasoningBuffer = (forced: boolean = false) => {
    // On finalization, dump any pending characters and stop the reveal loop
    if (reasoningRevealTimerRef.current) { clearTimeout(reasoningRevealTimerRef.current); reasoningRevealTimerRef.current = null; }
    if (reasoningRafIdRef.current != null) { cancelAnimationFrame(reasoningRafIdRef.current); reasoningRafIdRef.current = null; }
    const buf = reasoningBufferRef.current;
    if (!buf && !forced) return;
    const state = useConversationStore.getState();
    const conv = state.conversations.find(c => c.id === sessionId);
    const msgs = conv?.messages || [];
    const last: any = msgs[msgs.length - 1];
    const newReasoning = ((last?.reasoning as string) || '') + (buf || '');
    updateLastMessageReasoning(sessionId, newReasoning, { isStreaming: true });
    reasoningBufferRef.current = '';
    if (reasoningFlushTimerRef.current) { clearTimeout(reasoningFlushTimerRef.current); reasoningFlushTimerRef.current = null; }
  };

  // rAF-driven reveal loop: coalesce updates to animation frames to avoid UI jank
  const reasoningFrame = () => {
    reasoningRafIdRef.current = null;
    if (!reasoningBufferRef.current || reasoningBufferRef.current.length === 0) {
      return;
    }
    const backlog = reasoningBufferRef.current.length;
    // Base chars per frame derived from rate
    const base = Math.max(1, Math.min(8, Math.round((reasoningStatsRef.current.ewmaRateCps || 120) * FRAME_TARGET_MS / 1000)));
    // Scale up with backlog to catch up quickly without flooding
    let take = base;
    if (backlog > 200) take = Math.min(32, base * 4);
    else if (backlog > 100) take = Math.min(24, base * 3);
    else if (backlog > 40) take = Math.min(16, base * 2);

    const chunk = reasoningBufferRef.current.slice(0, take);
    reasoningBufferRef.current = reasoningBufferRef.current.slice(take);

    const state = useConversationStore.getState();
    const conv = state.conversations.find(c => c.id === sessionId);
    const msgs = conv?.messages || [];
    const last: any = msgs[msgs.length - 1];
    const newReasoning = ((last?.reasoning as string) || '') + chunk;
    updateLastMessageReasoning(sessionId, newReasoning, { isStreaming: true });

    // Schedule next frame if backlog remains
    if (reasoningBufferRef.current.length > 0) {
      reasoningRafIdRef.current = requestAnimationFrame(reasoningFrame);
    }
  };

  // no-op placeholder removed

  const addMessageToStore = (message: ChatMessage) => {
    // Ensure conversation exists using fresh state
    const state = useConversationStore.getState();
    const conversationExists = state.conversations.find(conv => conv.id === sessionId);
    if (!conversationExists) {
      if (DEBUG) console.log(`Creating conversation for session ${sessionId}`);
      createConversation('New Chat', 'agent', sessionId);
    }

    // Convert message format and add to store
    const conversationMessage = {
      id: message.id,
      role: message.type === 'user' ? 'user' as const : message.type === 'agent' ? 'assistant' as const : 'system' as const,
      content: message.content,
      timestamp: message.timestamp.getTime(),
      isStreaming: (message as any).isStreaming || false,
      reasoning: (message as any).reasoning || '',
      isReasoningStreaming: (message as any).isReasoningStreaming || false,
      toolOutput: (message as any).toolOutput || '',
      isToolStreaming: (message as any).isToolStreaming || false,
    } as any;
    if (DEBUG) console.log(`Add message ${sessionId}:`, (conversationMessage.content || '').toString().slice(0, 80));
    addMessage(sessionId, conversationMessage);
  };

  const handleCodexEvent = (event: CodexEvent) => {
    const { msg } = event;
    
    switch (msg.type) {
      case 'session_configured':
        console.log('Session configured:', msg.session_id);
        break;
        
      case 'task_started':
        resetAnswerStats();
        resetToolBuffer();
        setSessionLoading(sessionId, true);
        break;
        
      case 'task_complete':
        flushBuffer(true);
        flushReasoningBuffer(true);
        flushToolBuffer(true);
        resetToolBuffer();
        resetAnswerStats();
        setSessionLoading(sessionId, false);
        snapshotConversations();
        // Mark last assistant as not streaming
        {
          const state = useConversationStore.getState();
          const conv = state.conversations.find(c => c.id === sessionId);
          const msgs = conv?.messages || [];
          if (msgs.length > 0) {
            updateLastMessage(sessionId, (msgs[msgs.length - 1] as any).content || '', { isStreaming: false });
            updateLastMessageReasoning(sessionId, ((msgs[msgs.length - 1] as any).reasoning || ''), { isStreaming: false });
          }
        }
        break;

      case 'turn_complete':
        flushBuffer(true);
        flushReasoningBuffer(true);
        flushToolBuffer(true);
        resetToolBuffer();
        resetAnswerStats();
        setSessionLoading(sessionId, false);
        snapshotConversations();
        {
          const state = useConversationStore.getState();
          const conv = state.conversations.find(c => c.id === sessionId);
          const msgs = conv?.messages || [];
          if (msgs.length > 0) {
            updateLastMessage(sessionId, (msgs[msgs.length - 1] as any).content || '', { isStreaming: false });
            updateLastMessageReasoning(sessionId, ((msgs[msgs.length - 1] as any).reasoning || ''), { isStreaming: false });
          }
        }
        break;
        
      case 'agent_message': {
        // Prefer last_agent_message if present for full content
        const content = (msg as any).last_agent_message || msg.message || '';
        if (content) {
          flushBuffer(true);
          let state = useConversationStore.getState();
          let conv = state.conversations.find(c => c.id === sessionId);
          if (!conv) {
            createConversation('New Chat', 'agent', sessionId);
            state = useConversationStore.getState();
            conv = state.conversations.find(c => c.id === sessionId) || null as any;
          }
          const msgs = conv?.messages || [];
          const last = msgs[msgs.length - 1] as any;
          if (last && last.role === 'assistant') {
            updateLastMessage(sessionId, content, { isStreaming: false });
          } else {
            const agentMessage: ChatMessage = {
              id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              type: 'agent',
              content,
              timestamp: new Date(),
              isStreaming: false,
            } as any;
            addMessageToStore(agentMessage);
          }
        }
        break;
      }

      case 'agent_message_delta': {
        // Ensure conversation and assistant message exist
        let state = useConversationStore.getState();
        let conv = state.conversations.find(c => c.id === sessionId);
        if (!conv) {
          createConversation('New Chat', 'agent', sessionId);
          state = useConversationStore.getState();
          conv = state.conversations.find(c => c.id === sessionId) || null as any;
        }
        const msgs = conv?.messages || [];
        const last = msgs[msgs.length - 1] as any;
        if (!(last && last.role === 'assistant')) {
          const agentMessage: ChatMessage = {
            id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            type: 'agent',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
          } as any;
          addMessageToStore(agentMessage);
        }
        const deltaText = msg.delta || '';
        updateAnswerStats(deltaText.length);
        bufferRef.current = bufferRef.current + deltaText;
        scheduleFlush();
        break;
      }

      case 'agent_reasoning_delta': {
        if (DEBUG) console.log('[reasoning_delta] len', (msg as any).delta?.length || 0);
        // Ensure conversation and assistant message exist using freshest state
        let state = useConversationStore.getState();
        let conv = state.conversations.find(c => c.id === sessionId);
        if (!conv) {
          createConversation('New Chat', 'agent', sessionId);
          state = useConversationStore.getState();
          conv = state.conversations.find(c => c.id === sessionId) || null as any;
        }
        const msgs = conv?.messages || [];
        const last = msgs[msgs.length - 1] as any;
        if (!(last && last.role === 'assistant')) {
          const agentMessage: ChatMessage = {
            id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            type: 'agent',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
            reasoning: '',
            isReasoningStreaming: true,
          } as any;
          addMessageToStore(agentMessage);
        } else {
          // Mark that reasoning is streaming even if message already exists
          updateLastMessageReasoning(sessionId, (last.reasoning || ''), { isStreaming: true });
        }
        const deltaText = (msg as any).delta || '';
        updateReasoningStats(deltaText.length);
        reasoningBufferRef.current = reasoningBufferRef.current + deltaText;
        if (DEBUG) console.log('[reasoning_delta] buffer', reasoningBufferRef.current.length);
        // Begin rAF-driven reveal immediately (fast-start)
        if (!reasoningRafIdRef.current) {
          reasoningRafIdRef.current = requestAnimationFrame(reasoningFrame);
        }
        break;
      }

      case 'agent_reasoning': {
        // Final snapshot of reasoning text
        const text = (msg as any).text || '';
        if (DEBUG) console.log('[reasoning_snapshot] len', text.length);
        if (text) {
          // Append to buffer and let rAF loop handle display
          updateReasoningStats(text.length);
          reasoningBufferRef.current = reasoningBufferRef.current + text;
          if (!reasoningRafIdRef.current) {
            reasoningRafIdRef.current = requestAnimationFrame(reasoningFrame);
          }
          let state = useConversationStore.getState();
          let conv = state.conversations.find(c => c.id === sessionId);
          if (!conv) {
            createConversation('New Chat', 'agent', sessionId);
            state = useConversationStore.getState();
            conv = state.conversations.find(c => c.id === sessionId) || null as any;
          }
          const msgs = conv?.messages || [];
          const last = msgs[msgs.length - 1] as any;
          if (!(last && last.role === 'assistant')) {
            const agentMessage: ChatMessage = {
              id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              type: 'agent',
              content: '',
              timestamp: new Date(),
              isStreaming: true,
              reasoning: text,
              isReasoningStreaming: false,
            } as any;
            addMessageToStore(agentMessage);
          } else {
            updateLastMessageReasoning(sessionId, text, { isStreaming: false });
            if (DEBUG) console.log('[reasoning_snapshot] applied');
          }
        }
        break;
      }
        
      case 'exec_approval_request':
        onApprovalRequest({
          id: event.id,
          type: 'exec',
          command: msg.command,
          cwd: msg.cwd,
        });
        break;
        
      case 'patch_approval_request':
        onApprovalRequest({
          id: event.id,
          type: 'patch',
          patch: msg.patch,
          files: msg.files,
        });
        break;
        
      case 'error':
        const errorMessage: ChatMessage = {
          id: `${sessionId}-error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          type: 'system',
          content: `Error: ${msg.message}`,
          timestamp: new Date(),
        };
        addMessageToStore(errorMessage);
        setSessionLoading(sessionId, false);
        break;
        
      case 'shutdown_complete':
        if (DEBUG) console.log('Session shutdown completed');
        break;
        
      case 'background_event': {
        const state = useConversationStore.getState();
        let conv = state.conversations.find(c => c.id === sessionId);
        if (!conv) {
          createConversation('New Chat', 'agent', sessionId);
          conv = useConversationStore.getState().conversations.find(c => c.id === sessionId) || null as any;
        }
        toolBufferRef.current += `\n[info] ${msg.message}\n`;
        scheduleToolFlush();
        break;
      }
        
      case 'exec_command_begin': {
        const state = useConversationStore.getState();
        let conv = state.conversations.find(c => c.id === sessionId);
        if (!conv) {
          createConversation('New Chat', 'agent', sessionId);
          conv = useConversationStore.getState().conversations.find(c => c.id === sessionId) || null as any;
        }
        // Flush any pending buffered output before writing command header
        flushToolBuffer(false);
        const cmd = (msg as any).command?.join(' ') || '';
        toolBufferRef.current += `\n$ ${cmd}\n`;
        scheduleToolFlush();
        break;
      }
        
      case 'exec_command_output_delta': {
        const chunkArr: number[] = (msg as any).chunk || [];
        const text = String.fromCharCode(...chunkArr);
        toolBufferRef.current += text;
        scheduleToolFlush();
        break;
      }
        
      case 'exec_command_end': {
        // Flush any pending buffered output before adding exit code
        flushToolBuffer(false);
        const exit = (msg as any).exit_code;
        toolBufferRef.current += `\n[exit ${exit}]\n`;
        flushToolBuffer(true);
        break;
      }
        
      default:
        if (DEBUG) console.log('Unhandled event type:', (msg as any).type);
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    const eventUnlisten = listen<CodexEvent>(`codex-event-${sessionId}`, (event) => {
      const codexEvent = event.payload;
      if (DEBUG) console.log('evt:', codexEvent.msg?.type);
      handleCodexEvent(codexEvent);
    });
    
    const responseUnlisten = listen<string>(`codex-response:${sessionId}`, (event) => {
      const response = event.payload;
      if (DEBUG) console.log('response len:', (response || '').length);
      
      const agentMessage: ChatMessage = {
        id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: 'agent',
        content: response,
        timestamp: new Date(),
      };
      addMessageToStore(agentMessage);
      setSessionLoading(sessionId, false);
    });
    
    const errorUnlisten = listen<string>(`codex-error:${sessionId}`, (event) => {
      let errorLine = event.payload;
      if (DEBUG) console.log('stderr line');
      
      errorLine = errorLine.replace(/\u001b\[[0-9;]*m/g, '');
      
      if (errorLine.trim() && 
          !errorLine.includes('INFO') && 
          !errorLine.includes('WARN') &&
          !errorLine.includes('cwd not set') &&
          !errorLine.includes('resume_path: None') &&
          !errorLine.includes('Aborting existing session') &&
          !errorLine.includes('stream disconnected') &&
          !errorLine.includes('retrying turn')) {
        
        const errorMessage: ChatMessage = {
          id: `${sessionId}-error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          type: 'system',
          content: `Error: ${errorLine}`,
          timestamp: new Date(),
        };
        addMessageToStore(errorMessage);
        setSessionLoading(sessionId, false);
      }
    });

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (softFlushTimerRef.current) {
        clearTimeout(softFlushTimerRef.current);
        softFlushTimerRef.current = null;
      }
      if (answerSpoolerRef.current) {
        clearInterval(answerSpoolerRef.current);
        answerSpoolerRef.current = null;
      }
      if (reasoningFlushTimerRef.current) {
        clearTimeout(reasoningFlushTimerRef.current);
        reasoningFlushTimerRef.current = null;
      }
      // no reasoningSoftTimerRef in letter-by-letter mode
      eventUnlisten.then(fn => fn());
      responseUnlisten.then(fn => fn());
      errorUnlisten.then(fn => fn());
    };
  }, [sessionId]);

  return {};
};
