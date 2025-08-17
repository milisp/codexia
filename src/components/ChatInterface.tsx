import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApprovalRequest, CodexConfig } from "@/types/codex";
import type { Conversation } from "@/types/chat";
import { useConversationStore } from "../stores/ConversationStore";
import { sessionManager } from "../services/sessionManager";
import { SessionManager } from "./SessionManager";
import { ChatInput } from "./ChatInput";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./chat/MessageList";
import { ApprovalDialog } from "./ApprovalDialog";
import { useCodexEvents } from "../hooks/useCodexEvents";

interface ChatInterfaceProps {
  sessionId: string;
  config: CodexConfig;
  activeSessionId?: string;
  onCreateSession?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onCloseSession?: (sessionId: string) => void;
  isSessionListVisible?: boolean;
  selectedConversation?: Conversation | null;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  sessionId,
  config,
  activeSessionId: propActiveSessionId = "",
  onCreateSession,
  onSelectSession,
  onCloseSession,
  isSessionListVisible = false,
  selectedConversation = null,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [pendingApproval, setPendingApproval] =
    useState<ApprovalRequest | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tempSessionId, setTempSessionId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string>(sessionId);
  const [sessionStarting, setSessionStarting] = useState(false);

  const {
    conversations,
    addMessage,
    setSessionLoading,
    createConversation,
    pendingNewConversation,
    setPendingNewConversation,
    setCurrentConversation,
  } = useConversationStore();

  // Priority: selectedConversation (from disk) > conversations (from store)
  // If there's a pending new conversation, temp sessionId, or empty sessionId, show empty conversation
  const currentConversation = (pendingNewConversation || sessionId.startsWith('pending_') || !sessionId.trim())
    ? null
    : selectedConversation ||
      conversations.find((conv) => conv.id === activeSessionId) ||
      conversations.find((conv) => conv.id === sessionId);

  // Convert conversation messages to chat messages format
  const sessionMessages = currentConversation
    ? currentConversation.messages.map((msg) => ({
        id: msg.id,
        type: (msg.role === "user"
          ? "user"
          : msg.role === "assistant"
            ? "agent"
            : "system") as "user" | "agent" | "system",
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        isStreaming: (msg as any).isStreaming || false,
        reasoning: (msg as any).reasoning || '',
        isReasoningStreaming: (msg as any).isReasoningStreaming || false,
        toolOutput: (msg as any).toolOutput || '',
        isToolStreaming: (msg as any).isToolStreaming || false,
      }))
    : [];

  useCodexEvents({
    sessionId: activeSessionId,
    onApprovalRequest: setPendingApproval,
  });

  const messages = [...sessionMessages];
  const isLoading = currentConversation?.isLoading || false;

  // Update activeSessionId when sessionId prop changes
  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId && !tempSessionId && !sessionId.startsWith('pending_')) {
      setActiveSessionId(sessionId);
    }
  }, [sessionId, activeSessionId, tempSessionId]);

  useEffect(() => {
    if (sessionId) {
      const isRunning = sessionManager.isSessionRunning(sessionId);
      setIsConnected(isRunning);

      // Don't auto-start session if we're viewing a historical conversation or pending new conversation
      // Also don't auto-start if we're already starting a session in handleSendMessage
      if (
        !isRunning &&
        !sessionStarting &&
        messages.length === 0 &&
        !selectedConversation &&
        !pendingNewConversation &&
        !sessionId.startsWith('pending_') &&
        sessionId.trim()
      ) {
        const startSession = async () => {
          try {
            setSessionLoading(sessionId, true);
            await sessionManager.ensureSessionRunning(sessionId, config);
            setIsConnected(true);
            setSessionLoading(sessionId, false);
          } catch (error) {
            console.error("Failed to auto-start session:", error);
            const errorMessage = {
              id: `${sessionId}-auto-start-error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              role: "system" as const,
              content: `Failed to start Codex session: ${error}`,
              timestamp: Date.now(),
            };
            addMessage(sessionId, errorMessage);
            setSessionLoading(sessionId, false);
          }
        };

        startSession();
      }
    }
  }, [sessionId, selectedConversation, pendingNewConversation, sessionStarting]);

  const handleSendMessage = async (messageContent: string) => {
    console.log("=== handleSendMessage called ===");
    console.log("messageContent:", messageContent);
    console.log("sessionId:", sessionId);
    console.log("pendingNewConversation:", pendingNewConversation);
    console.log("isLoading:", isLoading);
    
    if (!messageContent.trim() || isLoading) {
      console.log("Message empty or loading, returning");
      return;
    }

    let actualSessionId = sessionId;

    // Handle pending new conversation, temporary sessionId, or empty sessionId
    let isPendingSession = false;
    if (pendingNewConversation || sessionId.startsWith('pending_') || !sessionId.trim()) {
      // For pending new conversation or empty sessionId, don't create conversation yet
      // Let codex create the session first, then get the real session ID
      console.log("Pending new conversation detected, will create after codex session is established");
      actualSessionId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log("Generated actualSessionId:", actualSessionId);
      setTempSessionId(actualSessionId);
      setPendingNewConversation(false);
      isPendingSession = true; // Use local variable instead of relying on state
    } else {
      // If no conversation exists, get a new session ID from backend
      const conversationExists = conversations.find(
        (conv) => conv.id === sessionId,
      );
      if (!conversationExists) {
        try {
          // Get the latest session ID from backend
          const latestSessionId = await invoke<string | null>(
            "get_latest_session_id",
          );
          if (latestSessionId) {
            actualSessionId = latestSessionId;
            console.log("Using existing session ID:", actualSessionId);
          } else {
            console.log(
              "No existing session, will create new one when sending message",
            );
          }

          // Create conversation with the real session ID
          createConversation("New Chat", "agent", actualSessionId);
        } catch (error) {
          console.error("Failed to get session ID:", error);
          // Fallback to current sessionId
        }
      }
    }

    // For pending sessions, use a simple session ID that codex can work with
    let sessionToStart = actualSessionId;
    if (isPendingSession) {
      // Use a simple session ID for codex to start with
      sessionToStart = `chat_${Date.now()}`;
    }

    console.log("sessionToStart:", sessionToStart);
    console.log("tempSessionId:", tempSessionId);
    console.log("isPendingSession:", isPendingSession);

    // Ensure session is running before sending message
    try {
      console.log("Checking if session is running:", sessionToStart);
      if (!sessionManager.isSessionRunning(sessionToStart)) {
        console.log("Session not running, starting session...");
        setSessionStarting(true); // Prevent useEffect from starting another session
        setSessionLoading(sessionToStart, true);
        await sessionManager.ensureSessionRunning(sessionToStart, config);
        setIsConnected(true);
        console.log("Session started successfully");
        
        // If this was a pending session, just use the started session ID
        if (isPendingSession) {
          console.log("Using started session ID for pending session");
          actualSessionId = sessionToStart;
          
          // Remove any existing pending conversation
          const pendingConversations = conversations.filter(conv => conv.id.startsWith('pending_'));
          for (const pendingConv of pendingConversations) {
            console.log(`Removing pending conversation: ${pendingConv.id}`);
            // deleteConversation(pendingConv.id); // Don't delete, just let it be replaced
          }
          
          // Create conversation with the session ID we started
          createConversation("New Chat", "agent", actualSessionId);
          setCurrentConversation(actualSessionId);
          setActiveSessionId(actualSessionId); // Update active session ID for events
          setTempSessionId(null);
        }
        
        setSessionLoading(actualSessionId, false);
        setSessionStarting(false); // Reset the flag
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      setSessionStarting(false); // Reset the flag on error
      const errorMessage = {
        id: `${actualSessionId}-startup-error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: "system" as const,
        content: `Failed to start Codex session: ${error}`,
        timestamp: Date.now(),
      };
      addMessage(actualSessionId, errorMessage);
      setSessionLoading(actualSessionId, false);
      return;
    }

    // Add user message to conversation store
    const userMessage = {
      id: `${actualSessionId}-user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      role: "user" as const,
      content: messageContent,
      timestamp: Date.now(),
    };
    console.log("Adding user message to store:", userMessage);
    addMessage(actualSessionId, userMessage);

    setSessionLoading(actualSessionId, true);

    try {
      console.log("Sending message to backend with sessionId:", actualSessionId);
      await invoke("send_message", {
        sessionId: actualSessionId,
        message: messageContent,
      });
      console.log("Message sent successfully");
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = {
        id: `${actualSessionId}-send-error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: "system" as const,
        content: `Failed to send message: ${error}`,
        timestamp: Date.now(),
      };
      addMessage(actualSessionId, errorMessage);
      setSessionLoading(actualSessionId, false);
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!pendingApproval) return;

    try {
      await invoke("approve_execution", {
        sessionId,
        approvalId: pendingApproval.id,
        approved,
      });
      setPendingApproval(null);
    } catch (error) {
      console.error("Failed to send approval:", error);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Session Manager - conditionally visible */}
      {isSessionListVisible &&
        onCreateSession &&
        onSelectSession &&
        onCloseSession && (
          <div className="w-64 flex-shrink-0 border-r bg-white">
            <SessionManager
              conversations={conversations}
              activeSessionId={propActiveSessionId}
              onCreateSession={onCreateSession}
              onSelectSession={onSelectSession}
              onCloseSession={onCloseSession}
            />
          </div>
        )}

      {/* Chat Interface */}
      <div className="flex flex-col flex-1 min-h-0">
        <ChatHeader
          isConnected={isConnected}
          isHistoryView={!!selectedConversation}
          historyMessageCount={selectedConversation?.messages.length || 0}
        />

        <MessageList 
          messages={messages} 
          isLoading={isLoading} 
          isPendingNewConversation={pendingNewConversation || sessionId.startsWith('pending_') || !sessionId.trim()}
        />

        <ApprovalDialog
          pendingApproval={pendingApproval}
          onApproval={handleApproval}
        />

        <ChatInput
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          disabled={false}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
