export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  image?: string;
  isStreaming?: boolean;
  reasoning?: string;
  isReasoningStreaming?: boolean;
}

export type ChatMode = "chat" | "agent";

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  mode: ChatMode;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  filePath?: string;
  isLoading?: boolean;
}

export interface ChatRequest {
  message: string;
  provider: string;
  model: string;
}

export type Provider =
  | "anthropic"
  | "openai"
  | "openrouter"
  | "google"
  | "ollama";


export interface ProviderConfig {
    value: Provider;
    label: string;
    models: string[];
    defaultBaseUrl?: string;
  }
  

export interface AppConfig {
  provider?: string;
  api_key?: string;
  chat_url?: string;
  model_name?: string;
  proxy?: boolean;
  support_tool?: boolean;
}
