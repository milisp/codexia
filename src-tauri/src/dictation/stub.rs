use serde::Serialize;
use crate::{DictationEvent, DictationModelStatus, DictationModelState, DictationSessionState, DictationState, EventSink};

const DEFAULT_MODEL_ID: &str = "base";
const UNSUPPORTED_MESSAGE: &str = "Dictation is not available on mobile builds.";

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DictationModelState {
    Missing,
    Downloading,
    Ready,
    Error,
}

#[derive(Debug, Serialize, Clone)]
pub struct DictationDownloadProgress {
    #[serde(rename = "downloadedBytes")]
    pub downloaded_bytes: u64,
    #[serde(rename = "totalBytes")]
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DictationModelStatus {
    pub state: DictationModelState,
    #[serde(rename = "modelId")]
    pub model_id: String,
    pub progress: Option<DictationDownloadProgress>,
    pub error: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DictationSessionState {
    Idle,
    Listening,
    Processing,
}

pub struct DictationState {
    pub model_status: DictationModelStatus,
    pub session_state: DictationSessionState,
}

impl Default for DictationState {
    fn default() -> Self {
        Self {
            model_status: DictationModelStatus {
                state: DictationModelState::Missing,
                model_id: DEFAULT_MODEL_ID.to_string(),
                progress: None,
                error: Some(UNSUPPORTED_MESSAGE.to_string()),
                path: None,
            },
            session_state: DictationSessionState::Idle,
        }
    }
}

pub async fn dictation_model_status(
    _event_sink: Arc<dyn EventSink>,
    _state: &DictationState,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    Ok(DictationModelStatus {
        state: DictationModelState::Missing,
        model_id: model_id.unwrap_or_else(|| DEFAULT_MODEL_ID.to_string()),
        progress: None,
        error: Some(UNSUPPORTED_MESSAGE.to_string()),
        path: None,
    })
}

pub async fn dictation_download_model(
    event_sink: Arc<dyn EventSink>,
    state: &DictationState,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    dictation_model_status(event_sink, state, model_id).await
}

pub async fn dictation_cancel_download(
    event_sink: Arc<dyn EventSink>,
    state: &DictationState,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    dictation_model_status(event_sink, state, model_id).await
}

pub async fn dictation_remove_model(
    event_sink: Arc<dyn EventSink>,
    state: &DictationState,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    dictation_model_status(event_sink, state, model_id).await
}

pub async fn dictation_start(
    _preferred_language: Option<String>,
    _model_id: Option<String>,
    _event_sink: Arc<dyn EventSink>,
    _state: &DictationState,
) -> Result<DictationSessionState, String> {
    Err(UNSUPPORTED_MESSAGE.to_string())
}

pub async fn dictation_request_permission(_event_sink: Arc<dyn EventSink>) -> Result<bool, String> {
    Ok(false)
}

pub async fn dictation_stop(
    _event_sink: Arc<dyn EventSink>,
    _state: &DictationState,
) -> Result<DictationSessionState, String> {
    Err(UNSUPPORTED_MESSAGE.to_string())
}

pub async fn dictation_cancel(
    _event_sink: Arc<dyn EventSink>,
    _state: &DictationState,
) -> Result<DictationSessionState, String> {
    Err(UNSUPPORTED_MESSAGE.to_string())
}