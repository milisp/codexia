use serde::{Deserialize, Serialize};
use crate::env::get_envs;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LocalModel {
    pub id: String,
    pub context_length: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProviderConfig {
    pub model_provider: String,
    pub base_url: String,
    pub api_key_url: Option<String>,
    pub signup_url: Option<String>,
    pub env_key: String,
    pub auto_discover: bool,
    pub models: Option<Vec<LocalModel>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RootConfig {
    pub object: String,
    pub data: Vec<ProviderConfig>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RemoteModelItem {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub owned_by: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RemoteModelResponse {
    pub object: String,
    pub data: Vec<RemoteModelItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnvStatusItem {
    pub provider: String,
    pub env_key: String,
    pub is_env_set: bool,
    pub api_key_url: Option<String>,
    pub signup_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FrontendModel {
    pub id: String,
    pub context_length: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FrontendProviderModels {
    pub provider: String,
    pub models: Vec<FrontendModel>,
}

pub async fn load_env_keys() -> Result<Vec<EnvStatusItem>, String> {
    let json_str = include_str!("./llms.json");
    let config: RootConfig = serde_json::from_str(json_str).map_err(|e| e.to_string())?;

    let env_keys: Vec<String> = config.data.iter().map(|p| p.env_key.clone()).collect();
    let env_values = get_envs(&env_keys);

    let mut result = Vec::new();

    for provider in config.data {
        let is_env_set = env_values.contains_key(&provider.env_key);

        result.push(EnvStatusItem {
            provider: provider.model_provider,
            env_key: provider.env_key,
            is_env_set,
            api_key_url: provider.api_key_url,
            signup_url: provider.signup_url,
        });
    }

    Ok(result)
}

pub async fn load_and_fetch_models() -> Result<Vec<FrontendProviderModels>, String> {
    let json_str = include_str!("./llms.json");
    let config: RootConfig = serde_json::from_str(json_str).map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let mut result = Vec::new();

    for provider in config.data {
        let mut frontend_models = Vec::new();

        if provider.auto_discover {
            let url = format!("{}/models", provider.base_url.trim_end_matches('/'));
            if let Ok(resp) = client.get(&url).send().await {
                if let Ok(remote_data) = resp.json::<RemoteModelResponse>().await {
                    for model in remote_data.data {
                        frontend_models.push(FrontendModel {
                            id: model.id,
                            context_length: None,
                        });
                    }
                }
            }
        } else if let Some(static_models) = provider.models {
            for model in static_models {
                frontend_models.push(FrontendModel {
                    id: model.id,
                    context_length: Some(model.context_length),
                });
            }
        }

        result.push(FrontendProviderModels {
            provider: provider.model_provider,
            models: frontend_models,
        });
    }

    Ok(result)
}