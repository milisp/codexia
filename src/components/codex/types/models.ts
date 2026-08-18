// Matches Rust FrontendModel
export type FrontendModel = {
  id: string;
  context_length?: number;
};

// Matches Rust FrontendProviderModels
export type FrontendProviderModels = {
  provider: string;
  models: FrontendModel[];
};

// Matches Rust EnvStatusItem
export type EnvStatusItem = {
  provider: string;
  env_key: string;
  is_env_set: boolean;
  api_key_url?: string;
  signup_url?: string;
};

// Matches Rust ProviderConfig — a suggestion from the bundled llms.json,
// applied only when the user adds it.
export type ProviderPreset = {
  model_provider: string;
  base_url: string;
  api_key_url?: string;
  signup_url?: string;
  env_key: string;
  auto_discover: boolean;
  models?: { id: string; context_length: number }[];
};

// Matches Rust ConfigProvider — a provider present in the user's config.toml.
export type ConfigProvider = {
  name: string;
  base_url?: string | null;
  env_key?: string | null;
};

export type ModelListItem = {
  id: string;
  label: string;
  description?: string;
};
