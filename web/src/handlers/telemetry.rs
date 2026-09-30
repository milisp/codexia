use axum::Json;
use serde::Deserialize;

use codexia_telemetry::{Consent, Event, Status};

use crate::types::ErrorResponse;

#[derive(Deserialize)]
pub(crate) struct SetConsentParams {
    pub consent: Consent,
}

pub(crate) async fn api_telemetry_status() -> Json<Status> {
    Json(codexia_telemetry::status())
}

pub(crate) async fn api_telemetry_set_consent(
    Json(params): Json<SetConsentParams>,
) -> Result<Json<Status>, ErrorResponse> {
    codexia_telemetry::set_consent(params.consent).map_err(|error| ErrorResponse { error })?;
    Ok(Json(codexia_telemetry::status()))
}

/// Called once per app start by each client; the backend applies all gating and dedupe.
pub(crate) async fn api_telemetry_active() -> Json<serde_json::Value> {
    codexia_telemetry::track(Event::AppActive);
    Json(serde_json::json!({ "ok": true }))
}
