import { useRef, useEffect } from 'react';
import { Bot, User, Terminal } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/types/chat';
import type { ChatMessage as CodexMessageType } from '@/types/codex';

// Unified message type
type UnifiedMessage = ChatMessageType | CodexMessageType;

interface MessageListProps {
  messages: UnifiedMessage[];
  className?: string;
  isLoading?: boolean;
  isPendingNewConversation?: boolean;
}

export function MessageList({ messages, className = "", isLoading = false, isPendingNewConversation = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Prefer instant scroll during streaming to avoid smooth-scroll backlog
  const hasStreaming = Array.isArray(messages) && messages.some((m: any) => (m as any).isStreaming || (m as any).isReasoningStreaming || (m as any).isToolStreaming);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: hasStreaming ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, hasStreaming]);

  // Helper to normalize message data
  const normalizeMessage = (msg: UnifiedMessage) => {
    // Check if it's a codex message (has 'type' property)
    if ('type' in msg) {
      return {
        id: msg.id,
        role: msg.type === 'user' ? 'user' : msg.type === 'agent' ? 'assistant' : 'system',
        content: msg.content,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.getTime() : new Date().getTime(),
        isStreaming: (msg as any).isStreaming || false,
        reasoning: (msg as any).reasoning || '',
        isReasoningStreaming: (msg as any).isReasoningStreaming || false,
      };
    }
    // It's a chat message (has 'role' property)
    return {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : new Date().getTime(),
      isStreaming: (msg as any).isStreaming || false,
      reasoning: (msg as any).reasoning || '',
      isReasoningStreaming: (msg as any).isReasoningStreaming || false,
    };
  };

  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="w-5 h-5 text-blue-600" />;
      case 'assistant':
        return <Bot className="w-5 h-5 text-green-600" />;
      case 'system':
        return <Terminal className="w-5 h-5 text-gray-600" />;
      default:
        return <div className="w-5 h-5 bg-gray-400 rounded-full" />;
    }
  };

  const getMessageStyle = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-50 border-blue-200';
      case 'assistant':
        return 'bg-white border-gray-200';
      case 'system':
        return 'bg-gray-50 border-gray-300';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = (message: UnifiedMessage, index: number) => {
    const normalized = normalizeMessage(message);
    const isUser = normalized.role === 'user';
    const isLastMessage = index === messages.length - 1;

    return (
      <div
        key={`${normalized.id}-${index}`}
        className={`flex gap-3 p-4 ${isLastMessage ? 'mb-4' : ''}`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-blue-100' : 'bg-green-100'
          }`}>
            {getMessageIcon(normalized.role)}
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900 capitalize">
              {normalized.role === 'assistant' ? 'Assistant' : normalized.role}
            </span>
            <span className="text-xs text-gray-500">
              {formatTime(normalized.timestamp)}
            </span>
          </div>

          {/* Reasoning (always visible) */}
          {normalized.role === 'assistant' && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">Thinking</div>
              <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-700 whitespace-pre-wrap">
                {normalized.reasoning || (!normalized.isReasoningStreaming && 'No thinking tokens available for this response.')}
                {normalized.isReasoningStreaming && (
                  <span className="inline-block w-2 h-4 bg-current opacity-75 animate-pulse ml-1 align-text-bottom">|</span>
                )}
              </div>
            </div>
          )}

          {/* Execution output (always visible) */}
          {normalized.role === 'assistant' && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">Execution</div>
              <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-700 whitespace-pre-wrap">
                {(normalized as any).toolOutput || ''}
                {(normalized as any).isToolStreaming && (
                  <span className="inline-block w-2 h-4 bg-current opacity-75 animate-pulse ml-1 align-text-bottom">|</span>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className={`rounded-lg border p-3 ${getMessageStyle(normalized.role)}`}>
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {normalized.content}
              {normalized.isStreaming && (
                <span className="inline-block w-2 h-5 bg-current opacity-75 animate-pulse ml-1 align-text-bottom">|</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (messages.length === 0) {
    return (
      <div className={`flex-1 min-h-0 flex items-center justify-center ${className}`}>
        <div className="text-center space-y-4 max-w-md">
          <Bot className="w-12 h-12 text-gray-400 mx-auto" />
          {isPendingNewConversation ? (
            <>
              <h3 className="text-lg font-medium text-gray-800">Ready to start</h3>
              <p className="text-gray-600">
                Type a message below to start your new conversation with the AI assistant.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-800">No messages</h3>
              <p className="text-gray-600">
                This conversation doesn't have any messages yet.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="max-w-4xl mx-auto">
          {messages.map((message, index) => renderMessage(message, index))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 p-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-100">
                  <Bot className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">Assistant</span>
                </div>
                <div className="rounded-lg border p-3 bg-white border-gray-200">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
