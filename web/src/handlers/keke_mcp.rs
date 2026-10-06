use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use codexia_acp::mcp::{self, McpServers};
use crate::types::ErrorResponse;

#[derive(Deserialize)]
pub(crate) struct KekeMcpParams {
    name: String,
    config: Option<Value>,
}

pub(crate) async fn api_keke_read_mcp_servers() -> Result<Json<McpServers>, ErrorResponse> {
    mcp::read_mcp_servers().await.map(Json).map_err(|error| ErrorResponse { error })
}

pub(crate) async fn api_keke_add_mcp_server(Json(params): Json<KekeMcpParams>) -> Result<Json<()>, ErrorResponse> {
    let config = params.config.ok_or_else(|| ErrorResponse { error: "Missing config".into() })?;
    mcp::add_mcp_server(params.name, config).await.map(Json).map_err(|error| ErrorResponse { error })
}

pub(crate) async fn api_keke_remove_mcp_server(Json(params): Json<KekeMcpParams>) -> Result<Json<()>, ErrorResponse> {
    mcp::remove_mcp_server(params.name).await.map(Json).map_err(|error| ErrorResponse { error })
}

pub(crate) async fn api_keke_mcp_auth_statuses() -> Result<Json<std::collections::BTreeMap<String, mcp::McpAuthStatus>>, ErrorResponse> {
    mcp::read_mcp_auth_statuses().await.map(Json).map_err(|error| ErrorResponse { error })
}

pub(crate) async fn api_keke_mcp_login(Json(params): Json<KekeMcpParams>) -> Result<Json<()>, ErrorResponse> {
    mcp::login_mcp_server(params.name).await.map(Json).map_err(|error| ErrorResponse { error })
}

#[derive(Deserialize)]
pub(crate) struct GitHubMcpAuthParams {
    name: String,
    token: String,
}

pub(crate) async fn api_keke_mcp_authorize_github(Json(params): Json<GitHubMcpAuthParams>) -> Result<Json<()>, ErrorResponse> {
    mcp::authorize_github_mcp(params.name, params.token).await.map(Json).map_err(|error| ErrorResponse { error })
}
