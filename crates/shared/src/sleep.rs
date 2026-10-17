use std::{
    collections::HashSet,
    sync::{Arc, LazyLock},
};

#[cfg(not(target_env = "musl"))]
use nosleep::{NoSleep, NoSleepType};
use tokio::sync::Mutex;

pub struct SleepState {
    controller: Arc<Mutex<NoSleepController>>,
}

impl SleepState {
    pub fn new() -> Self {
        Self {
            controller: Arc::new(Mutex::new(NoSleepController::new())),
        }
    }

    pub async fn prevent_sleep(&self, conversation_id: Option<String>) -> Result<(), String> {
        let mut controller = self.controller.lock().await;
        controller.prevent_sleep(conversation_id)
    }

    pub async fn allow_sleep(&self, conversation_id: Option<String>) -> Result<(), String> {
        let mut controller = self.controller.lock().await;
        controller.allow_sleep(conversation_id)
    }
}

/// Process-wide holds taken by backend work (bot runs) rather than by a
/// frontend request, so they survive the window closing and are released by
/// `Drop` even when the run errors out.
static HOLDS: LazyLock<std::sync::Mutex<NoSleepController>> =
    LazyLock::new(|| std::sync::Mutex::new(NoSleepController::new()));

/// Keeps the computer from idle-sleeping while it is alive. The display may
/// still sleep, and closing a laptop lid or a manual sleep is not prevented.
pub struct KeepAwake {
    key: String,
}

impl KeepAwake {
    /// `key` must be unique per holder; a second hold with the same key is
    /// the same hold.
    pub fn hold(key: impl Into<String>) -> Self {
        let key = key.into();
        if let Ok(mut holds) = HOLDS.lock()
            && let Err(e) = holds.prevent_sleep(Some(key.clone()))
        {
            log::warn!("keep-awake: could not prevent sleep: {e}");
        }
        Self { key }
    }
}

impl Drop for KeepAwake {
    fn drop(&mut self) {
        if let Ok(mut holds) = HOLDS.lock()
            && let Err(e) = holds.allow_sleep(Some(std::mem::take(&mut self.key)))
        {
            log::warn!("keep-awake: could not allow sleep: {e}");
        }
    }
}

impl Default for SleepState {
    fn default() -> Self {
        Self::new()
    }
}

/// On musl (headless servers) there is no sleep inhibitor: holds are only
/// counted, and the host's own power settings apply.
struct NoSleepController {
    #[cfg(not(target_env = "musl"))]
    nosleep: Option<NoSleep>,
    active_conversations: HashSet<String>,
}

impl NoSleepController {
    fn new() -> Self {
        Self {
            #[cfg(not(target_env = "musl"))]
            nosleep: None,
            active_conversations: HashSet::new(),
        }
    }

    fn prevent_sleep(&mut self, conversation_id: Option<String>) -> Result<(), String> {
        let key = conversation_id.unwrap_or_else(|| "__global__".to_string());
        let inserted = self.active_conversations.insert(key);
        if !inserted {
            return Ok(());
        }
        if self.active_conversations.len() > 1 {
            return Ok(());
        }

        #[cfg(not(target_env = "musl"))]
        {
            if self.nosleep.is_none() {
                self.nosleep = Some(NoSleep::new().map_err(|err| err.to_string())?);
            }
            if let Some(nosleep) = self.nosleep.as_mut() {
                nosleep
                    .start(NoSleepType::PreventUserIdleSystemSleep)
                    .map_err(|err| err.to_string())?;
            }
        }

        Ok(())
    }

    fn allow_sleep(&mut self, conversation_id: Option<String>) -> Result<(), String> {
        match conversation_id {
            Some(id) => {
                if !self.active_conversations.remove(&id) {
                    return Ok(());
                }
            }
            None => {
                if self.active_conversations.is_empty() {
                    return Ok(());
                }
                self.active_conversations.clear();
            }
        }

        #[cfg(not(target_env = "musl"))]
        if self.active_conversations.is_empty()
            && let Some(nosleep) = self.nosleep.as_ref()
        {
            nosleep.stop().map_err(|err| err.to_string())?;
        }

        Ok(())
    }
}
