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
  const { addMessage, updateLastMessage, updateLastMessageReasoning, updateLastMessageToolOutput, setSessionLoading, createConversation } = useConversationStore();

  // Buffer for streaming answer deltas to reduce UI churn
  const bufferRef = useRef<string>('');
  const flushTimerRef = useRef<any>(null);

  const flushBuffer = () => {
    const buf = bufferRef.current;
    if (!buf) return;
    const state = useConversationStore.getState();
    const conv = state.conversations.find(c => c.id === sessionId);
    const msgs = conv?.messages || [];
    const last = msgs[msgs.length - 1] as any;
    const newContent = ((last?.content as string) || '') + buf;
    updateLastMessage(sessionId, newContent, { isStreaming: true });
    bufferRef.current = '';
    flushTimerRef.current = null;
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flushBuffer, 80);
  };

  // Separate buffer for reasoning deltas
  const reasoningBufferRef = useRef<string>('');
  const reasoningFlushTimerRef = useRef<any>(null);

  const flushReasoningBuffer = () => {
    const buf = reasoningBufferRef.current;
    if (!buf) return;
    const state = useConversationStore.getState();
    const conv = state.conversations.find(c => c.id === sessionId);
    const msgs = conv?.messages || [];
    const last: any = msgs[msgs.length - 1];
    const newReasoning = ((last?.reasoning as string) || '') + buf;
    updateLastMessageReasoning(sessionId, newReasoning, { isStreaming: true });
    reasoningBufferRef.current = '';
    reasoningFlushTimerRef.current = null;
  };

  const scheduleReasoningFlush = () => {
    if (reasoningFlushTimerRef.current) return;
    reasoningFlushTimerRef.current = setTimeout(flushReasoningBuffer, 80);
  };

  const addMessageToStore = (message: ChatMessage) => {
    // Ensure conversation exists using fresh state
    const state = useConversationStore.getState();
    const conversationExists = state.conversations.find(conv => conv.id === sessionId);
    if (!conversationExists) {
      console.log(`Creating conversation for session ${sessionId} from event`);
      createConversation('New Chat', 'agent', sessionId);
    }

    // Convert message format and add to store
    const conversationMessage = {
      id: message.id,
      role: message.type === 'user' ? 'user' as const : message.type === 'agent' ? 'assistant' as const : 'system' as const,
      content: message.content,
      timestamp: message.timestamp.getTime(),
      isStreaming: (message as any).isStreaming || false,
    } as any;
    console.log(`Adding message to session ${sessionId}:`, (conversationMessage.content || '').toString().substring(0, 100));
    addMessage(sessionId, conversationMessage);
  };

  const handleCodexEvent = (event: CodexEvent) => {
    const { msg } = event;
    
    switch (msg.type) {
      case 'session_configured':
        console.log('Session configured:', msg.session_id);
        break;
        
      case 'task_started':
        setSessionLoading(sessionId, true);
        break;
        
      case 'task_complete':
        flushBuffer();
        flushReasoningBuffer();
        setSessionLoading(sessionId, false);
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
        flushBuffer();
        flushReasoningBuffer();
        setSessionLoading(sessionId, false);
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
          flushBuffer();
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
        bufferRef.current = bufferRef.current + (msg.delta || '');
        scheduleFlush();
        break;
      }

      case 'agent_reasoning_delta': {
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
        reasoningBufferRef.current = reasoningBufferRef.current + ((msg as any).delta || '');
        scheduleReasoningFlush();
        break;
      }

      case 'agent_reasoning': {
        // Final snapshot of reasoning text
        const text = (msg as any).text || '';
        if (text) {
          flushReasoningBuffer();
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
        console.log('Session shutdown completed');
        break;
        
      case 'background_event': {
        const state = useConversationStore.getState();
        let conv = state.conversations.find(c => c.id === sessionId);
        if (!conv) {
          createConversation('New Chat', 'agent', sessionId);
          conv = useConversationStore.getState().conversations.find(c => c.id === sessionId) || null as any;
        }
        const msgs = conv?.messages || [];
        const last = msgs[msgs.length - 1] as any;
        const prev = (last?.toolOutput as string) || '';
        updateLastMessageToolOutput(sessionId, prev + `\n[info] ${msg.message}\n`, { isStreaming: true });
        break;
      }
        
      case 'exec_command_begin': {
        const state = useConversationStore.getState();
        let conv = state.conversations.find(c => c.id === sessionId);
        if (!conv) {
          createConversation('New Chat', 'agent', sessionId);
          conv = useConversationStore.getState().conversations.find(c => c.id === sessionId) || null as any;
        }
        const msgs = conv?.messages || [];
        const last = msgs[msgs.length - 1] as any;
        const prev = (last?.toolOutput as string) || '';
        const cmd = (msg as any).command?.join(' ') || '';
        updateLastMessageToolOutput(sessionId, prev + `\n$ ${cmd}\n`, { isStreaming: true });
        break;
      }
        
      case 'exec_command_output_delta': {
        const state = useConversationStore.getState();
        const conv = state.conversations.find(c => c.id === sessionId);
        const msgs = conv?.messages || [];
        const last = msgs[msgs.length - 1] as any;
        const prev = (last?.toolOutput as string) || '';
        const chunkArr: number[] = (msg as any).chunk || [];
        const text = String.fromCharCode(...chunkArr);
        updateLastMessageToolOutput(sessionId, prev + text, { isStreaming: true });
        break;
      }
        
      case 'exec_command_end': {
        const state = useConversationStore.getState();
        const conv = state.conversations.find(c => c.id === sessionId);
        const msgs = conv?.messages || [];
        const last = msgs[msgs.length - 1] as any;
        const prev = (last?.toolOutput as string) || '';
        const exit = (msg as any).exit_code;
        updateLastMessageToolOutput(sessionId, prev + `\n[exit ${exit}]\n`, { isStreaming: false });
        break;
      }
        
      default:
        console.log('Unhandled event type:', (msg as any).type);
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    const eventUnlisten = listen<CodexEvent>(`codex-event-${sessionId}`, (event) => {
      const codexEvent = event.payload;
      console.log('Received codex event:', codexEvent);
      handleCodexEvent(codexEvent);
    });
    
    const responseUnlisten = listen<string>(`codex-response:${sessionId}`, (event) => {
      const response = event.payload;
      console.log('Received codex response:', response);
      
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
      console.log('Received codex error:', errorLine);
      
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
      eventUnlisten.then(fn => fn());
      responseUnlisten.then(fn => fn());
      errorUnlisten.then(fn => fn());
    };
  }, [sessionId]);

  return {};
};
