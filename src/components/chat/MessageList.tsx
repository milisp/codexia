import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/types/chat';
import type { ApprovalRequest } from '@/types/codex';
import { TextSelectionMenu } from './TextSelectionMenu';
import { Message } from './Message';
import { useTextSelection } from '../../hooks/useTextSelection';
import BouncingDotsLoader from './BouncingDotsLoader';
import { WelcomeSection } from './WelcomeSection';

// Unified message type
type UnifiedMessage = ChatMessageType;

interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_input_tokens?: number;
  reasoning_output_tokens?: number;
}

interface MessageListProps {
  messages: UnifiedMessage[];
  className?: string;
  isLoading?: boolean;
  isPendingNewConversation?: boolean;
  onApproval?: (approved: boolean, approvalRequest: ApprovalRequest) => void;
  tokenUsage?: TokenUsage;
  sessionId?: string;
  model?: string;
}

export function MessageList({ 
  messages, 
  className = "", 
  isLoading = false, 
  onApproval,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const { selectedText } = useTextSelection();
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const jumpToTop = useCallback(() => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const jumpToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  // Check if scroll buttons should be shown
  const checkScrollButtons = useCallback(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const shouldShow = container.scrollHeight > container.clientHeight + 100; // 100px threshold
      setShowScrollButtons(shouldShow);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
    checkScrollButtons();
  }, [messages, scrollToBottom, checkScrollButtons]);

  // Check scroll buttons on resize
  useEffect(() => {
    const handleResize = () => checkScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkScrollButtons]);

  // Prefer upstream messageType; provide minimal fallback for plan_update only
  const getMessageType = useCallback((msg: UnifiedMessage): 'reasoning' | 'tool_call' | 'plan_update' | 'exec_command' | 'normal' | undefined => {
    const provided = (msg as any).messageType as any;
    if (provided) return provided;
    const eventType = (msg as any).eventType as string | undefined;
    if (eventType === 'plan_update') return 'plan_update';
    const title = ('title' in msg ? (msg as any).title : '') || '';
    if (title.includes('📋')) return 'plan_update';
    const id = msg.id || '';
    if (id.includes('-plan-')) return 'plan_update';
    const content = msg.content || '';
    if ((content.includes('✅') || content.includes('🔄') || content.includes('⏳')) && content.includes('\n- ')) {
      return 'plan_update';
    }
    return undefined;
  }, []);

  // Helper to normalize message data - memoized to prevent re-calculations
  const normalizeMessage = useCallback((msg: UnifiedMessage) => {
    let content = msg.content;
    let role: string;
    
    // Check if it's a codex message (has 'type' property)
    if ('type' in msg) {
      role = msg.type === 'user' ? 'user' : msg.type === 'agent' ? 'assistant' : msg.type === 'approval' ? 'approval' : 'system';
    } else {
      // It's a chat message (has 'role' property)
      role = msg.role;
    }
    
    // Use provided messageType; fallback only for plan_update
    const messageType = getMessageType(msg);
    
    const ts: any = (msg as any).timestamp;
    const normalizedTimestamp = ts instanceof Date
      ? ts.getTime()
      : typeof ts === 'number'
        ? ts
        : new Date().getTime();

    const baseMessage = {
      id: msg.id,
      role: role as "user" | "assistant" | "system" | "approval",
      content,
      // Preserve optional title for preview/header rendering
      title: ('title' in msg ? (msg as any).title : undefined),
      timestamp: normalizedTimestamp,
      isStreaming: ('isStreaming' in msg ? msg.isStreaming : false) || false,
      model: ('model' in msg ? (msg.model as string) : undefined),
      workingDirectory: ('workingDirectory' in msg ? (msg.workingDirectory as string) : undefined),
      approvalRequest: (msg as any).approvalRequest || undefined,
      messageType,
      // Pass through raw event type from codex when present
      eventType: (msg as any).eventType || undefined,
      // Pass through structured plan payload when present
      plan: (msg as any).plan || undefined,
    };
    
    return baseMessage;
  }, [getMessageType]);

  // Memoize normalized messages to avoid re-computation
  const normalizedMessages = useMemo(() => {
    return messages.map(normalizeMessage);
  }, [messages, normalizeMessage]);

  if (messages.length === 0) {
    return (
      <div className={`flex-1 min-h-0 flex items-center justify-center ${className}`}>
        <WelcomeSection />
      </div>
    );
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 relative ${className}`}>
      {/* Single Text Selection Menu for all messages */}
      <TextSelectionMenu />
      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-2 py-2"
        onScroll={checkScrollButtons}
      >
        <div className="w-full max-w-full min-w-0">
          {normalizedMessages.map((normalizedMessage, index) => {
            const prev = index > 0 ? normalizedMessages[index - 1] : undefined;
            const next = index < normalizedMessages.length - 1 ? normalizedMessages[index + 1] : undefined;

            // Group reasoning under the following assistant message and hide the standalone reasoning entry
            if (normalizedMessage.messageType === 'reasoning' && next?.role === 'assistant') {
              return null;
            }

            // Do not render turn_diff as a full message; summarized elsewhere near ChatInput
            if ((normalizedMessage as any).eventType === 'turn_diff') {
              return null;
            }

            const inlineReasoningContent = prev?.messageType === 'reasoning' ? prev.content : undefined;

            return (
              <Message
                key={`${normalizedMessage.id}-${index}`}
                message={normalizedMessage}
                index={index}
                isLastMessage={index === messages.length - 1}
                selectedText={selectedText}
                previousMessage={prev}
                onApproval={onApproval}
                allMessages={normalizedMessages}
                inlineReasoningContent={inlineReasoningContent}
              />
            );
          })}
          
          {/* Loading indicator */}
          {isLoading && (
            <BouncingDotsLoader />
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>
      
      {/* Jump Navigation Buttons */}
      {showScrollButtons && (
        <div className="absolute right-4 bottom-20 flex flex-col gap-1 z-10">
          <button
            onClick={jumpToTop}
            className="bg-white border border-gray-200 rounded-full p-2 shadow-md hover:bg-gray-50 transition-colors"
            title="jumpToTop"
          >
            <ChevronUp className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={jumpToBottom}
            className="bg-white border border-gray-200 rounded-full p-2 shadow-md hover:bg-gray-50 transition-colors"
            title="jumpToBottom"
          >
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );
}
