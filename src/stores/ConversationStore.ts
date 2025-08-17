import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type { Conversation, ChatMessage, ChatMode } from "@/types/chat";
import { CodexConfig, DEFAULT_CONFIG } from "@/types/codex";

interface ConversationStore {
  // Configuration
  config: CodexConfig;
  setConfig: (config: CodexConfig) => void;
  
  // Conversations
  conversations: Conversation[];
  currentConversationId: string | null;
  sessionDisconnected: boolean;
  pendingUserInput: string | null;
  pendingNewConversation: boolean;

  // Conversation management
  createConversation: (title?: string, mode?: ChatMode, sessionId?: string) => string;
  createConversationWithLatestSession: (title?: string, mode?: ChatMode) => Promise<string>;
  selectOrCreateExternalSession: (sessionId: string, name?: string) => void;
  deleteConversation: (id: string) => void;
  setCurrentConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  updateConversationMode: (id: string, mode: ChatMode) => void;
  toggleFavorite: (id: string) => void;

  // Session management
  setSessionDisconnected: (disconnected: boolean) => void;
  setPendingUserInput: (input: string | null) => void;
  addDisconnectionWarning: (conversationId: string) => void;
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  setPendingNewConversation: (pending: boolean) => void;

  // Message management
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateLastMessage: (conversationId: string, content: string, opts?: { isStreaming?: boolean }) => void;
  updateLastMessageReasoning: (conversationId: string, reasoning: string, opts?: { isStreaming?: boolean }) => void;
  updateLastMessageToolOutput: (conversationId: string, output: string, opts?: { isStreaming?: boolean }) => void;

  // Getters
  getCurrentConversation: () => Conversation | null;
  getCurrentMessages: () => ChatMessage[];
}

const generateTitle = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find((msg) => msg.role === "user");
  if (firstUserMessage) {
    const content = firstUserMessage.content.trim();
    return content.length > 50 ? content.substring(0, 50) + "..." : content;
  }
  return "New Conversation";
};

// Function to get the latest running codex session ID
const getLatestRunningSessionId = async (): Promise<string | null> => {
  try {
    const result = await invoke<string[]>('get_running_sessions');
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to get running sessions:', error);
    return null;
  }
};

// Export function to create conversation with latest running session or create new one
export const createConversationWithLatestSession = async (title?: string, mode: ChatMode = "agent"): Promise<string> => {
  const store = useConversationStore.getState();
  
  // Try to get a running session first
  const runningSessionId = await getLatestRunningSessionId();
  
  if (runningSessionId) {
    // Check if conversation with this session ID already exists
    const existingConversation = store.conversations.find(conv => conv.id === runningSessionId);
    if (existingConversation) {
      store.setCurrentConversation(runningSessionId);
      return runningSessionId;
    }
    
    // Create new conversation with existing session ID
    store.createConversation(title, mode, runningSessionId);
    return runningSessionId;
  } else {
    // No running session, create a new conversation (which will start a new session)
    return store.createConversation(title, mode);
  }
};

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      config: DEFAULT_CONFIG,
      conversations: [],
      currentConversationId: null,
      sessionDisconnected: false,
      pendingUserInput: null,
      pendingNewConversation: false,

      // Configuration
      setConfig: (config) => {
        set({ config });
      },

      createConversation: (title?: string, mode: ChatMode = "agent", sessionId?: string) => {
        // Use provided sessionId or generate a simple UUID-like ID for the conversation
        const id = sessionId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const state = get();
        
        // Check if conversation with this ID already exists (unlikely but possible)
        const existingConversation = state.conversations.find(conv => conv.id === id);
        if (existingConversation) {
          // Just set as current if it already exists
          set({ currentConversationId: id });
          return id;
        }

        const now = Date.now();
        const newConversation: Conversation = {
          id,
          title: title || "New Conversation",
          messages: [],
          mode,
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
        };

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: id,
        }));

        return id;
      },

  // Expose helper that creates/selects a conversation using the latest running session
  createConversationWithLatestSession: createConversationWithLatestSession,


      selectOrCreateExternalSession: (sessionId: string, name?: string) => {
        set((state) => {
          // Check if conversation already exists
          const existingConversation = state.conversations.find(s => s.id === sessionId);
          
          if (existingConversation) {
            // Conversation exists, just select it
            return {
              currentConversationId: sessionId,
            };
          } else {
            // Conversation doesn't exist, create it
            const now = Date.now();
            const newConversation: Conversation = {
              id: sessionId,
              title: name || "External Session",
              messages: [],
              mode: "agent",
              createdAt: now,
              updatedAt: now,
              isFavorite: false,
            };
            
            return {
              currentConversationId: sessionId,
              conversations: [newConversation, ...state.conversations]
            };
          }
        });
      },

      deleteConversation: (id: string) => {
        set((state) => {
          const updatedConversations = state.conversations.filter(
            (conv) => conv.id !== id,
          );
          const newCurrentId =
            state.currentConversationId === id
              ? updatedConversations.length > 0
                ? updatedConversations[0].id
                : null
              : state.currentConversationId;
          
          console.log("deleteConversation", id)

          return {
            conversations: updatedConversations,
            currentConversationId: newCurrentId,
          };
        });
      },

      setCurrentConversation: (id: string) => {
        set({ currentConversationId: id });
      },

      updateConversationTitle: (id: string, title: string) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv,
          ),
        }));
      },

      updateConversationMode: (id: string, mode: ChatMode) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id ? { ...conv, mode, updatedAt: Date.now() } : conv,
          ),
        }));
      },

      toggleFavorite: (id: string) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id 
              ? { ...conv, isFavorite: !conv.isFavorite, updatedAt: Date.now() } 
              : conv,
          ),
        }));
      },

      setSessionDisconnected: (disconnected: boolean) => {
        set({ sessionDisconnected: disconnected });
      },

      setPendingUserInput: (input: string | null) => {
        set({ pendingUserInput: input });
      },

      setPendingNewConversation: (pending: boolean) => {
        set({ pendingNewConversation: pending });
      },


      setSessionLoading: (sessionId: string, loading: boolean) => {
        set((state) => ({
          conversations: state.conversations.map(conv =>
            conv.id === sessionId
              ? { ...conv, isLoading: loading }
              : conv
          )
        }));
      },

      addDisconnectionWarning: (conversationId: string) => {
        const warningMessage: ChatMessage = {
          id: `${conversationId}-disconnection-warning-${Date.now()}`,
          role: "system",
          content: "⚠️ Codex session has been disconnected. Your previous conversation history cannot be resumed. Please start a new conversation to continue chatting with the AI assistant.",
          timestamp: Date.now(),
        };

        set((state) => ({
          conversations: state.conversations.map((conv) => {
            if (conv.id === conversationId) {
              return {
                ...conv,
                messages: [...conv.messages, warningMessage],
                updatedAt: Date.now(),
              };
            }
            return conv;
          }),
        }));
      },

      addMessage: (conversationId: string, message: ChatMessage) => {
        set((state) => {
          const updatedConversations = state.conversations.map((conv) => {
            if (conv.id === conversationId) {
              const updatedMessages = [...conv.messages, message];
              const title =
                conv.title === "New Conversation" &&
                updatedMessages.length === 1
                  ? generateTitle(updatedMessages)
                  : conv.title;

              return {
                ...conv,
                messages: updatedMessages,
                title,
                updatedAt: Date.now(),
              };
            }
            return conv;
          });

          return { conversations: updatedConversations };
        });
      },

      updateLastMessage: (conversationId: string, content: string, opts?: { isStreaming?: boolean }) => {
        set((state) => ({
          conversations: state.conversations.map((conv) => {
            if (conv.id === conversationId && conv.messages.length > 0) {
              const updatedMessages = [...conv.messages];
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                content,
                ...(opts && typeof opts.isStreaming !== 'undefined' ? { isStreaming: opts.isStreaming } : {}),
              };

              return {
                ...conv,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
            }
            return conv;
          }),
        }));
      },

      updateLastMessageReasoning: (conversationId: string, reasoning: string, opts?: { isStreaming?: boolean }) => {
        set((state) => ({
          conversations: state.conversations.map((conv) => {
            if (conv.id === conversationId && conv.messages.length > 0) {
              const updatedMessages = [...conv.messages];
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                reasoning,
                ...(opts && typeof opts.isStreaming !== 'undefined' ? { isReasoningStreaming: opts.isStreaming } : {}),
              } as any;

              return {
                ...conv,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
            }
            return conv;
          }),
        }));
      },

      updateLastMessageToolOutput: (conversationId: string, output: string, opts?: { isStreaming?: boolean }) => {
        set((state) => ({
          conversations: state.conversations.map((conv) => {
            if (conv.id === conversationId && conv.messages.length > 0) {
              const updatedMessages = [...conv.messages];
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                toolOutput: output,
                ...(opts && typeof opts.isStreaming !== 'undefined' ? { isToolStreaming: opts.isStreaming } : {}),
              } as any;

              return {
                ...conv,
                messages: updatedMessages,
                updatedAt: Date.now(),
              };
            }
            return conv;
          }),
        }));
      },

      getCurrentConversation: () => {
        const { conversations, currentConversationId } = get();
        return (
          conversations.find((conv) => conv.id === currentConversationId) ||
          null
        );
      },

      getCurrentMessages: () => {
        const current = get().getCurrentConversation();
        return current?.messages || [];
      },
    }),
    {
      name: "conversation-storage", 
      version: 4,
      partialize: (state) => ({
        config: state.config,
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
      }),
      migrate: (persistedState: any, version: number) => {
        if (version < 4) {
          // Migrate from version 3: add config field
          persistedState.config = persistedState.config || DEFAULT_CONFIG;
        }

        return persistedState;
      },
    },
  ),
);
