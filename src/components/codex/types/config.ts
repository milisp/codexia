export interface ModelProvider {
  name: string;
  base_url: string;
  env_key?: string;
  requires_openai_auth?: boolean;
}
