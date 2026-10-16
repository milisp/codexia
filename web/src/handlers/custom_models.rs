//! User-added model ids per provider, shared by every client (desktop, browser, mobile).
//! Stored as `~/.codexia/custom-models.json`, written atomically.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use axum::Json;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use super::to_error_response;
use crate::types::ErrorResponse;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct CustomModel {
    pub id: String,
    pub name: String,
}

pub(crate) type CustomModels = BTreeMap<String, Vec<CustomModel>>;

#[derive(Deserialize)]
pub(crate) struct AddCustomModelParams {
    provider: String,
    id: String,
    #[serde(default)]
    name: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct RemoveCustomModelParams {
    provider: String,
    id: String,
}

// Serializes read-modify-write cycles so concurrent requests cannot lose updates.
static LOCK: Mutex<()> = Mutex::const_new(());

fn store_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    Ok(home.join(".codexia").join("custom-models.json"))
}

fn load(path: &Path) -> Result<CustomModels, String> {
    match std::fs::read_to_string(path) {
        Ok(text) if text.trim().is_empty() => Ok(CustomModels::new()),
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("custom-models.json: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(CustomModels::new()),
        Err(e) => Err(e.to_string()),
    }
}

fn save(path: &Path, models: &CustomModels) -> Result<(), String> {
    let dir = path.parent().ok_or("invalid custom models path")?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(models).map_err(|e| e.to_string())?;
    let mut tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| e.to_string())?;
    std::io::Write::write_all(&mut tmp, text.as_bytes()).map_err(|e| e.to_string())?;
    tmp.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}

fn add(
    models: &mut CustomModels,
    provider: &str,
    id: &str,
    name: Option<&str>,
) -> Result<(), String> {
    let provider = provider.trim();
    let id = id.trim();
    if provider.is_empty() {
        return Err("provider must not be empty".into());
    }
    if id.is_empty() {
        return Err("model id must not be empty".into());
    }
    let name = name.map(str::trim).filter(|n| !n.is_empty()).unwrap_or(id);
    let list = models.entry(provider.to_string()).or_default();
    if !list.iter().any(|m| m.id == id) {
        list.push(CustomModel {
            id: id.to_string(),
            name: name.to_string(),
        });
    }
    Ok(())
}

fn remove(models: &mut CustomModels, provider: &str, id: &str) -> Result<(), String> {
    let provider = provider.trim();
    let id = id.trim();
    if provider.is_empty() || id.is_empty() {
        return Err("provider and model id must not be empty".into());
    }
    if let Some(list) = models.get_mut(provider) {
        list.retain(|m| m.id != id);
        if list.is_empty() {
            models.remove(provider);
        }
    }
    Ok(())
}

pub(crate) async fn api_custom_models_list() -> Result<Json<CustomModels>, ErrorResponse> {
    let path = store_path().map_err(to_error_response)?;
    let _guard = LOCK.lock().await;
    load(&path).map(Json).map_err(to_error_response)
}

pub(crate) async fn api_custom_models_add(
    Json(p): Json<AddCustomModelParams>,
) -> Result<Json<CustomModels>, ErrorResponse> {
    let path = store_path().map_err(to_error_response)?;
    let _guard = LOCK.lock().await;
    let mut models = load(&path).map_err(to_error_response)?;
    add(&mut models, &p.provider, &p.id, p.name.as_deref()).map_err(to_error_response)?;
    save(&path, &models).map_err(to_error_response)?;
    Ok(Json(models))
}

pub(crate) async fn api_custom_models_remove(
    Json(p): Json<RemoveCustomModelParams>,
) -> Result<Json<CustomModels>, ErrorResponse> {
    let path = store_path().map_err(to_error_response)?;
    let _guard = LOCK.lock().await;
    let mut models = load(&path).map_err(to_error_response)?;
    remove(&mut models, &p.provider, &p.id).map_err(to_error_response)?;
    save(&path, &models).map_err(to_error_response)?;
    Ok(Json(models))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_dedupes_trims_and_validates() {
        let mut m = CustomModels::new();
        add(&mut m, " p ", " a ", None).unwrap();
        add(&mut m, "p", "a", Some("Other")).unwrap();
        add(&mut m, "p", "b", Some("B")).unwrap();
        assert_eq!(m["p"].len(), 2);
        assert_eq!(
            m["p"][0],
            CustomModel {
                id: "a".into(),
                name: "a".into()
            }
        );
        assert!(add(&mut m, "", "x", None).is_err());
        assert!(add(&mut m, "p", "  ", None).is_err());
    }

    #[test]
    fn remove_drops_empty_provider() {
        let mut m = CustomModels::new();
        add(&mut m, "p", "a", None).unwrap();
        remove(&mut m, "p", "a").unwrap();
        assert!(m.is_empty());
        assert!(remove(&mut m, "p", "").is_err());
    }

    #[test]
    fn save_and_load_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sub").join("custom-models.json");
        assert!(load(&path).unwrap().is_empty());
        let mut m = CustomModels::new();
        add(&mut m, "p", "a", Some("A")).unwrap();
        save(&path, &m).unwrap();
        assert_eq!(load(&path).unwrap(), m);
    }
}
