use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Event callback type
/// Accepts event name and JSON data
pub type EventCallback = Arc<dyn Fn(&str, JsonValue) -> Result<(), String> + Send + Sync>;

/// EventBus - replaces Tauri's event system
/// Provides publish/subscribe pattern for event management
#[derive(Clone)]
pub struct EventBus {
    subscribers: Arc<RwLock<HashMap<String, Vec<EventCallback>>>>,
}

impl EventBus {
    /// Create a new event bus
    pub fn new() -> Self {
        Self {
            subscribers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Subscribe to an event
    ///
    /// # Arguments
    /// * `event` - Event name
    /// * `callback` - Event callback function
    pub async fn subscribe(&self, event: impl Into<String>, callback: EventCallback) {
        let event = event.into();
        let mut subscribers = self.subscribers.write().await;
        subscribers
            .entry(event)
            .or_insert_with(Vec::new)
            .push(callback);
    }

    /// Emit an event
    ///
    /// # Arguments
    /// * `event` - Event name
    /// * `data` - Event data (JSON format)
    pub async fn emit(&self, event: impl Into<String>, data: JsonValue) {
        let event = event.into();
        let subscribers = self.subscribers.read().await;

        if let Some(callbacks) = subscribers.get(&event) {
            log::debug!("[EventBus] Emitting event: {} to {} subscribers", event, callbacks.len());
            for callback in callbacks {
                // Ignore callback errors, continue notifying other subscribers
                let _ = callback(&event, data.clone());
            }
        } else {
            log::warn!("[EventBus] No subscribers for event: {}", event);
        }
    }

    /// Clear all subscriptions
    pub async fn clear(&self) {
        let mut subscribers = self.subscribers.write().await;
        subscribers.clear();
    }

    /// Unsubscribe from a specific event
    pub async fn unsubscribe(&self, event: &str) {
        let mut subscribers = self.subscribers.write().await;
        subscribers.remove(event);
    }

    /// Get all subscribed event names
    pub async fn event_names(&self) -> Vec<String> {
        let subscribers = self.subscribers.read().await;
        subscribers.keys().cloned().collect()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_event_bus_basic() {
        let bus = EventBus::new();
        let received = Arc::new(RwLock::new(Vec::new()));
        let received_clone = received.clone();

        // Subscribe to events
        bus.subscribe(
            "test-event",
            Arc::new(move |event, data| {
                let received = received_clone.clone();
                tokio::spawn(async move {
                    received.write().await.push((event.to_string(), data));
                });
                Ok(())
            }),
        )
        .await;

        // Emit events
        bus.emit("test-event", json!({"message": "hello"})).await;

        // Wait for asynchronous operations to complete
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let received = received.read().await;
        assert_eq!(received.len(), 1);
        assert_eq!(received[0].0, "test-event");
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let bus = EventBus::new();
        let counter = Arc::new(RwLock::new(0));

        // Add multiple subscribers
        for _ in 0..3 {
            let counter_clone = counter.clone();
            bus.subscribe(
                "count",
                Arc::new(move |_, _| {
                    let counter = counter_clone.clone();
                    tokio::spawn(async move {
                        *counter.write().await += 1;
                    });
                    Ok(())
                }),
            )
            .await;
        }

        // Emit event
        bus.emit("count", json!({})).await;

        // Wait for all subscribers to finish processing
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        assert_eq!(*counter.read().await, 3);
    }

    #[tokio::test]
    async fn test_unsubscribe() {
        let bus = EventBus::new();

        bus.subscribe(
            "test",
            Arc::new(|_, _| Ok(())),
        )
        .await;

        assert_eq!(bus.event_names().await.len(), 1);

        bus.unsubscribe("test").await;

        assert_eq!(bus.event_names().await.len(), 0);
    }
}
