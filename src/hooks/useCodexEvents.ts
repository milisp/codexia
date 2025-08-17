import { useEffect } from 'react';
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
  const { addMessage, updateLastMessage, setSessionLoading, createConversation, conversations } = useConversationStore();

  // Buffer for streaming deltas to reduce UI churn (single-word updates)
  const bufferRef = { current: '' } as { current: string };
  let flushTimer: any = null as any;

  const flushBuffer = () => {
    if (!bufferRef.current) return;
    const conv = conversations.find(c => c.id === sessionId);
    const msgs = conv?.messages || [];
    const last = msgs[msgs.length - 1];
    const newContent = ((last?.content as string) || '') + bufferRef.current;
    updateLastMessage(sessionId, newContent, { isStreaming: true });
    bufferRef.current = '';
    flushTimer = null;
  };

  const addMessageToStore = (message: ChatMessage) => {
    // Ensure conversation exists
    const conversationExists = conversations.find(conv => conv.id === sessionId);
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
    };
    console.log(`Adding message to session ${sessionId}:`, conversationMessage.content.substring(0, 100));
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
        setSessionLoading(sessionId, false);
        // Mark last assistant as not streaming
        {
          const conv = conversations.find(c => c.id === sessionId);
          const msgs = conv?.messages || [];
          if (msgs.length > 0) {
            updateLastMessage(sessionId, msgs[msgs.length - 1].content || '', { isStreaming: false });
          }
        }
        break;

      case 'turn_complete':
        flushBuffer();
        setSessionLoading(sessionId, false);
        {
          const conv = conversations.find(c => c.id === sessionId);
          const msgs = conv?.messages || [];
          if (msgs.length > 0) {
            updateLastMessage(sessionId, msgs[msgs.length - 1].content || '', { isStreaming: false });
          }
        }
        break;
        
      case 'agent_message': {
        // Prefer last_agent_message if present for full content
        const content = (msg as any).last_agent_message || msg.message || '';
        if (content) {
          let conv = conversations.find(c => c.id === sessionId);
          if (!conv) {
            createConversation('New Chat', 'agent', sessionId);
            conv = useConversationStore.getState().conversations.find(c => c.id === sessionId) || null as any;
          }
          const msgs = conv?.messages || [];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant') {
            updateLastMessage(sessionId, content, { isStreaming: true });
          } else {
            const agentMessage: ChatMessage = {
              id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              type: 'agent',
              content,
              timestamp: new Date(),
              isStreaming: true,
            };
            addMessageToStore(agentMessage);
          }
        }
        break;
      }

      case 'agent_message_delta': {
        // Ensure conversation and assistant message exist
        let conv = conversations.find(c => c.id === sessionId);
        if (!conv) {
          createConversation('New Chat', 'agent', sessionId);
          conv = useConversationStore.getState().conversations.find(c => c.id === sessionId) || null as any;
        }
        const msgs = conv?.messages || [];
        const last = msgs[msgs.length - 1];
        if (!(last && last.role === 'assistant')) {
          const agentMessage: ChatMessage = {
            id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            type: 'agent',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
          };
          addMessageToStore(agentMessage);
        }
        bufferRef.current += msg.delta;
        if (!flushTimer) {
          flushTimer = setTimeout(flushBuffer, 80);
        }
        break;
      }

      case 'agent_reasoning_delta':
        // For now, ignore in UI to avoid noisy single-word updates.
        break;
        
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
        
      case 'background_event':
        console.log('Background event:', msg.message);
        break;
        
      case 'exec_command_begin':
        console.log('Command execution started');
        break;
        
      case 'exec_command_output_delta':
        console.log('Command output:', (msg as any).stream || '');
        break;
        
      case 'exec_command_end':
        console.log('Command execution completed');
        break;
        
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
      eventUnlisten.then(fn => fn());
      responseUnlisten.then(fn => fn());
      errorUnlisten.then(fn => fn());
    };
  }, [sessionId]);

  return {};
};
