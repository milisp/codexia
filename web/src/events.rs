use std::collections::{HashSet, VecDeque};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use serde_json::Value;
use tokio::sync::broadcast;

/// How many recent events are retained for replay. Sized so a mobile client
/// backgrounded for a minute or two can still catch up without a full reload.
const REPLAY_BUFFER_CAPACITY: usize = 2048;

/// Fan-out capacity for connected clients. Each subscriber that falls this far
/// behind is dropped by `broadcast`, but the client recovers on reconnect via
/// `?since=`, so lagging costs a reconnect rather than losing data.
const SUBSCRIBER_CHANNEL_CAPACITY: usize = 1024;

/// An event stamped with a monotonically increasing sequence number.
///
/// The sequence number is what makes reconnects lossless: a client records the
/// highest `seq` it has processed and asks for everything after it.
#[derive(Clone, Debug, Serialize)]
pub struct SeqEvent {
    pub seq: u64,
    pub event: String,
    pub payload: Value,
}

/// Extracts the namespace an event belongs to, used by the `agents` filter.
///
/// Event names grew inconsistent over time (`codex:notification` uses a colon,
/// `codex/approval-request` a slash, `cc-message` a hyphen, `fs_change` an
/// underscore) and they double as Tauri event names on the desktop side, so
/// renaming them would mean touching the desktop listeners too. Normalizing
/// here keeps that churn out of the picture.
fn namespace_of(event: &str) -> &str {
    match event {
        "cc-message" => "cc",
        "fs_change" => "fs",
        _ => event.split([':', '/']).next().unwrap_or(event),
    }
}

/// Parses the `agents` query value (e.g. `codex,terminal`) into a filter set.
/// `None` means "no filtering" — every event is delivered.
pub fn parse_namespace_filter(agents: Option<&str>) -> Option<HashSet<String>> {
    let raw = agents?;
    let set: HashSet<String> = raw
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect();
    if set.is_empty() { None } else { Some(set) }
}

pub fn event_matches(filter: Option<&HashSet<String>>, event: &str) -> bool {
    match filter {
        None => true,
        Some(set) => set.contains(namespace_of(event)),
    }
}

struct Inner {
    buffer: VecDeque<SeqEvent>,
    next_seq: u64,
}

/// Stamps every emitted event with a sequence number, keeps a bounded replay
/// buffer, and fans out to connected WebSocket/SSE clients.
#[derive(Clone)]
pub struct EventHub {
    inner: Arc<Mutex<Inner>>,
    tx: broadcast::Sender<SeqEvent>,
}

impl EventHub {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(SUBSCRIBER_CHANNEL_CAPACITY);
        Self {
            inner: Arc::new(Mutex::new(Inner {
                buffer: VecDeque::with_capacity(REPLAY_BUFFER_CAPACITY),
                next_seq: 1,
            })),
            tx,
        }
    }

    /// Consumes the raw `(event, payload)` broadcast and republishes it with
    /// sequence numbers. A single consumer keeps the ordering total.
    pub fn spawn_from(source: &broadcast::Sender<(String, Value)>) -> Self {
        let hub = Self::new();
        let mut rx = source.subscribe();
        let sink = hub.clone();

        tokio::spawn(async move {
            loop {
                match rx.recv().await {
                    Ok((event, payload)) => sink.publish(event, payload),
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        // Events were dropped before they could be stamped, so
                        // they are unrecoverable — no seq was ever assigned.
                        // Log loudly: this means the source channel is undersized.
                        log::error!("[events] event hub lagged, {skipped} events lost before sequencing");
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        });

        hub
    }

    fn publish(&self, event: String, payload: Value) {
        let stamped = {
            let mut inner = self.inner.lock().expect("event hub mutex poisoned");
            let seq = inner.next_seq;
            inner.next_seq += 1;

            let stamped = SeqEvent { seq, event, payload };
            inner.buffer.push_back(stamped.clone());
            while inner.buffer.len() > REPLAY_BUFFER_CAPACITY {
                inner.buffer.pop_front();
            }
            stamped
        };

        // Err only means nobody is connected right now; the event is still buffered.
        let _ = self.tx.send(stamped);
    }

    /// Atomically snapshots the replay backlog and subscribes to live events.
    ///
    /// Both happen under the same lock that `publish` takes, so an event cannot
    /// slip between the snapshot and the subscription — the client sees no gap
    /// and no duplicate.
    pub fn subscribe(
        &self,
        since: Option<u64>,
        filter: Option<&HashSet<String>>,
    ) -> (Vec<SeqEvent>, broadcast::Receiver<SeqEvent>) {
        let inner = self.inner.lock().expect("event hub mutex poisoned");
        let rx = self.tx.subscribe();

        let backlog = match since {
            Some(since) => inner
                .buffer
                .iter()
                .filter(|e| e.seq > since && event_matches(filter, &e.event))
                .cloned()
                .collect(),
            // A fresh client has no cursor and does not want history replayed.
            None => Vec::new(),
        };

        (backlog, rx)
    }
}

impl Default for EventHub {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn filter(spec: &str) -> Option<HashSet<String>> {
        parse_namespace_filter(Some(spec))
    }

    #[test]
    fn namespace_handles_every_naming_style_in_use() {
        assert_eq!(namespace_of("codex:notification"), "codex");
        assert_eq!(namespace_of("codex/approval-request"), "codex");
        assert_eq!(namespace_of("terminal:data"), "terminal");
        assert_eq!(namespace_of("cc-message"), "cc");
        assert_eq!(namespace_of("fs_change"), "fs");
    }

    #[test]
    fn absent_filter_matches_everything() {
        assert!(event_matches(None, "cc-message"));
        assert!(event_matches(None, "codex:notification"));
    }

    #[test]
    fn filter_selects_by_namespace() {
        let codex_only = filter("codex");
        assert!(event_matches(codex_only.as_ref(), "codex:notification"));
        assert!(event_matches(codex_only.as_ref(), "codex/approval-request"));
        assert!(!event_matches(codex_only.as_ref(), "cc-message"));
        assert!(!event_matches(codex_only.as_ref(), "terminal:data"));

        let multi = filter("codex, terminal");
        assert!(event_matches(multi.as_ref(), "terminal:data"));
        assert!(event_matches(multi.as_ref(), "codex:stderr"));
        assert!(!event_matches(multi.as_ref(), "cc-message"));
    }

    #[test]
    fn empty_filter_spec_is_treated_as_no_filter() {
        assert!(parse_namespace_filter(Some("")).is_none());
        assert!(parse_namespace_filter(Some(" , ")).is_none());
        assert!(parse_namespace_filter(None).is_none());
    }

    #[test]
    fn sequence_numbers_start_at_one_and_increase() {
        let hub = EventHub::new();
        hub.publish("codex:notification".into(), json!({ "n": 1 }));
        hub.publish("codex:notification".into(), json!({ "n": 2 }));

        let (backlog, _rx) = hub.subscribe(Some(0), None);
        assert_eq!(backlog.iter().map(|e| e.seq).collect::<Vec<_>>(), vec![1, 2]);
    }

    #[test]
    fn since_replays_only_newer_events() {
        let hub = EventHub::new();
        for n in 0..5 {
            hub.publish("codex:notification".into(), json!({ "n": n }));
        }

        let (backlog, _rx) = hub.subscribe(Some(3), None);
        assert_eq!(backlog.iter().map(|e| e.seq).collect::<Vec<_>>(), vec![4, 5]);
    }

    #[test]
    fn fresh_client_without_cursor_gets_no_history() {
        let hub = EventHub::new();
        hub.publish("codex:notification".into(), json!({}));

        let (backlog, _rx) = hub.subscribe(None, None);
        assert!(backlog.is_empty());
    }

    #[test]
    fn replay_respects_the_namespace_filter() {
        let hub = EventHub::new();
        hub.publish("codex:notification".into(), json!({}));
        hub.publish("cc-message".into(), json!({}));
        hub.publish("codex:stderr".into(), json!({}));

        let codex_only = filter("codex");
        let (backlog, _rx) = hub.subscribe(Some(0), codex_only.as_ref());
        assert_eq!(backlog.iter().map(|e| e.seq).collect::<Vec<_>>(), vec![1, 3]);
    }

    #[test]
    fn buffer_is_bounded_and_drops_oldest_first() {
        let hub = EventHub::new();
        for _ in 0..(REPLAY_BUFFER_CAPACITY + 10) {
            hub.publish("codex:notification".into(), json!({}));
        }

        let (backlog, _rx) = hub.subscribe(Some(0), None);
        assert_eq!(backlog.len(), REPLAY_BUFFER_CAPACITY);
        // Oldest surviving event is the 11th published one.
        assert_eq!(backlog.first().expect("non-empty backlog").seq, 11);
    }

    #[tokio::test]
    async fn reconnect_across_a_publish_loses_nothing() {
        let hub = EventHub::new();
        hub.publish("codex:notification".into(), json!({ "n": 1 }));

        // Client processed seq 1, then dropped its connection.
        let last_seen = 1;

        // Events continue to arrive while the client is away.
        hub.publish("codex:notification".into(), json!({ "n": 2 }));
        hub.publish("codex:notification".into(), json!({ "n": 3 }));

        // Client reconnects with its cursor.
        let (backlog, mut rx) = hub.subscribe(Some(last_seen), None);
        assert_eq!(backlog.iter().map(|e| e.seq).collect::<Vec<_>>(), vec![2, 3]);

        // Live events continue from where the backlog ended, with no overlap.
        hub.publish("codex:notification".into(), json!({ "n": 4 }));
        let live = rx.recv().await.expect("receive live event");
        assert_eq!(live.seq, 4);
    }

    #[tokio::test]
    async fn stamps_events_from_the_source_channel() {
        let (tx, _) = broadcast::channel(16);
        let hub = EventHub::spawn_from(&tx);

        let (_, mut rx) = hub.subscribe(None, None);
        tx.send(("codex:notification".to_string(), json!({ "ok": true })))
            .expect("send source event");

        let received = tokio::time::timeout(std::time::Duration::from_secs(5), rx.recv())
            .await
            .expect("timed out waiting for stamped event")
            .expect("hub channel closed");

        assert_eq!(received.seq, 1);
        assert_eq!(received.event, "codex:notification");
        assert_eq!(received.payload, json!({ "ok": true }));
    }
}
