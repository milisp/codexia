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

export type ModelListItem = {
  id: string;
  label: string;
  description?: string;
};
