use std::{collections::HashSet, sync::Arc};

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

impl Default for SleepState {
    fn default() -> Self {
        Self::new()
    }
}

struct NoSleepController {
    nosleep: Option<NoSleep>,
    active_conversations: HashSet<String>,
}

impl NoSleepController {
    fn new() -> Self {
        Self {
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

        if self.active_conversations.is_empty()
            && let Some(nosleep) = self.nosleep.as_ref()
        {
            nosleep.stop().map_err(|err| err.to_string())?;
        }

        Ok(())
    }
}
