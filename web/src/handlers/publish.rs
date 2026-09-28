use super::to_error_response;
use axum::{Json, extract::State as AxumState};
use serde::Deserialize;
use serde_json::{Value, json};

use codexia_shared::publish::{
    self, ConnectStart, PublishGameParams, PublishGameResult, PublishProgress,
};

use crate::types::{ErrorResponse, WebServerState};

#[derive(Deserialize)]
pub(crate) struct ConnectPollParams {
    code: String,
}

pub(crate) async fn api_publish_connect_start() -> Json<ConnectStart> {
    Json(publish::connect_start())
}

pub(crate) async fn api_publish_connect_poll(
    Json(params): Json<ConnectPollParams>,
) -> Result<Json<Value>, ErrorResponse> {
    let approved = publish::connect_poll(&params.code)
        .await
        .map_err(to_error_response)?;
    Ok(Json(json!({ "approved": approved })))
}

pub(crate) async fn api_publish_disconnect() -> Result<Json<Value>, ErrorResponse> {
    publish::disconnect().map_err(to_error_response)?;
    Ok(Json(json!({ "ok": true })))
}

pub(crate) async fn api_publish_whoami() -> Result<Json<Value>, ErrorResponse> {
    let account = publish::whoami().await.map_err(to_error_response)?;
    Ok(Json(json!({ "account": account })))
}

pub(crate) async fn api_publish_game(
    AxumState(state): AxumState<WebServerState>,
    Json(params): Json<PublishGameParams>,
) -> Result<Json<PublishGameResult>, ErrorResponse> {
    let event_tx = state.event_tx.clone();
    let result = publish::publish_game(params, move |progress: PublishProgress| {
        let payload = serde_json::to_value(progress).unwrap_or(Value::Null);
        let _ = event_tx.send(("publish:progress".to_string(), payload));
    })
    .await
    .map_err(to_error_response)?;
    Ok(Json(result))
}
