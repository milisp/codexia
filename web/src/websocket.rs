use axum::{
    extract::{
        Query, State as AxumState,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::Deserialize;
use std::collections::HashSet;
use std::convert::Infallible;
use tokio::sync::broadcast;

use crate::events::{EventHub, SeqEvent, event_matches, parse_namespace_filter};

/// Query parameters shared by `/ws` and `/api/events`.
#[derive(Debug, Default, Deserialize)]
pub(super) struct EventStreamQuery {
    /// Highest sequence number the client has already processed. Everything
    /// after it is replayed on connect. Omit it to start from live events only.
    since: Option<u64>,
    /// Comma-separated namespaces to receive, e.g. `codex` or `codex,terminal`.
    /// Omit it to receive everything.
    agents: Option<String>,
}

impl EventStreamQuery {
    fn filter(&self) -> Option<HashSet<String>> {
        parse_namespace_filter(self.agents.as_deref())
    }
}

fn encode(event: &SeqEvent) -> String {
    serde_json::to_string(event).unwrap_or_else(|err| {
        // SeqEvent is plain data over an already-deserialized payload, so this
        // is unreachable in practice; degrade to a skippable frame if it happens.
        log::error!("[events] failed to serialize event {}: {err}", event.event);
        String::from("{}")
    })
}

pub(super) async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<EventStreamQuery>,
    AxumState(hub): AxumState<EventHub>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, hub, query))
}

async fn handle_socket(socket: WebSocket, hub: EventHub, query: EventStreamQuery) {
    let filter = query.filter();
    let (backlog, mut event_rx) = hub.subscribe(query.since, filter.as_ref());

    let (mut sender, mut receiver) = socket.split();

    let mut send_task = tokio::spawn(async move {
        for event in backlog {
            if sender
                .send(Message::Text(encode(&event).into()))
                .await
                .is_err()
            {
                return;
            }
        }

        loop {
            match event_rx.recv().await {
                Ok(event) => {
                    if !event_matches(filter.as_ref(), &event.event) {
                        continue;
                    }
                    if sender
                        .send(Message::Text(encode(&event).into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                // The client fell too far behind to be served from the live
                // channel. Close so it reconnects with `?since=` and is served
                // from the replay buffer instead of silently missing events.
                Err(broadcast::error::RecvError::Lagged(skipped)) => {
                    log::warn!("[events] websocket client lagged by {skipped}, closing to force resume");
                    break;
                }
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if matches!(msg, Message::Close(_)) {
                break;
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }
}

/// SSE endpoint — mobile clients subscribe here instead of `/ws`.
///
/// Frames are `data: {"seq":…,"event":…,"payload":…}\n\n`. Clients should
/// remember the last `seq` they processed and reconnect with `?since=<seq>` so
/// events emitted while they were disconnected are replayed.
pub(super) async fn sse_handler(
    Query(query): Query<EventStreamQuery>,
    AxumState(hub): AxumState<EventHub>,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let filter = query.filter();
    let (backlog, rx) = hub.subscribe(query.since, filter.as_ref());

    let replay = futures::stream::iter(
        backlog
            .into_iter()
            .map(|event| Ok(Event::default().data(encode(&event)))),
    );

    let live = futures::stream::unfold((rx, filter), |(mut rx, filter)| async move {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    if !event_matches(filter.as_ref(), &event.event) {
                        continue;
                    }
                    return Some((Ok(Event::default().data(encode(&event))), (rx, filter)));
                }
                // End the stream on lag: EventSource reconnects automatically,
                // and the client's `?since=` cursor closes the gap. Previously
                // this kept the stream open and silently dropped the events.
                Err(broadcast::error::RecvError::Lagged(skipped)) => {
                    log::warn!("[events] sse client lagged by {skipped}, ending stream to force resume");
                    return None;
                }
                Err(broadcast::error::RecvError::Closed) => return None,
            }
        }
    });

    Sse::new(replay.chain(live)).keep_alive(KeepAlive::default())
}

#[cfg(test)]
mod tests {
    use super::ws_handler;
    use crate::events::EventHub;
    use axum::{Router, routing::get};
    use futures::StreamExt;
    use serde_json::{Value, json};
    use tokio::net::TcpStream;
    use tokio::sync::broadcast;
    use tokio::task::JoinHandle;
    use tokio::time::{Duration, timeout};
    use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async, tungstenite::Message};

    type TestSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

    /// Boots the `/ws` route on an ephemeral port, returning the channel events
    /// are published on plus the address clients connect to.
    async fn serve() -> (broadcast::Sender<(String, Value)>, String, JoinHandle<()>) {
        let (event_tx, _) = broadcast::channel(64);
        let hub = EventHub::spawn_from(&event_tx);
        let app = Router::new().route("/ws", get(ws_handler)).with_state(hub);

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind websocket test listener");
        let addr = listener.local_addr().expect("read local addr");

        let server_task = tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .expect("run websocket test server");
        });

        (event_tx, addr.to_string(), server_task)
    }

    async fn connect(addr: &str, query: &str) -> TestSocket {
        let (socket, _) = timeout(
            Duration::from_secs(5),
            connect_async(format!("ws://{addr}/ws{query}")),
        )
        .await
        .expect("websocket handshake timeout")
        .expect("websocket handshake failed");
        socket
    }

    async fn next_json(socket: &mut TestSocket) -> Value {
        let message = timeout(Duration::from_secs(5), socket.next())
            .await
            .expect("timed out waiting for websocket message")
            .expect("websocket stream closed")
            .expect("websocket read failed");

        match message {
            Message::Text(text) => serde_json::from_str(&text).expect("parse websocket JSON"),
            other => panic!("expected text websocket message, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn websocket_route_accepts_connection_and_forwards_events() {
        let (event_tx, addr, server_task) = serve().await;
        let mut socket = connect(&addr, "").await;

        tokio::time::sleep(Duration::from_millis(50)).await;
        event_tx
            .send(("test:event".to_string(), json!({ "ok": true })))
            .expect("broadcast websocket event");

        let value = next_json(&mut socket).await;
        assert_eq!(value["event"], "test:event");
        assert_eq!(value["payload"], json!({ "ok": true }));
        assert_eq!(value["seq"], 1);

        server_task.abort();
    }

    #[tokio::test]
    async fn reconnecting_with_since_replays_missed_events() {
        let (event_tx, addr, server_task) = serve().await;

        let mut socket = connect(&addr, "").await;
        tokio::time::sleep(Duration::from_millis(50)).await;

        event_tx
            .send(("codex:notification".to_string(), json!({ "n": 1 })))
            .expect("publish first event");
        assert_eq!(next_json(&mut socket).await["seq"], 1);

        // Client drops off; events keep arriving while it is away.
        drop(socket);
        tokio::time::sleep(Duration::from_millis(50)).await;
        for n in 2..=3 {
            event_tx
                .send(("codex:notification".to_string(), json!({ "n": n })))
                .expect("publish event while client is away");
        }
        tokio::time::sleep(Duration::from_millis(50)).await;

        // Reconnect with the cursor: the gap is replayed, nothing is duplicated.
        let mut socket = connect(&addr, "?since=1").await;
        assert_eq!(next_json(&mut socket).await["payload"], json!({ "n": 2 }));
        assert_eq!(next_json(&mut socket).await["payload"], json!({ "n": 3 }));

        // Live events continue seamlessly after the replay.
        event_tx
            .send(("codex:notification".to_string(), json!({ "n": 4 })))
            .expect("publish live event");
        assert_eq!(next_json(&mut socket).await["payload"], json!({ "n": 4 }));

        server_task.abort();
    }

    #[tokio::test]
    async fn agents_filter_excludes_other_namespaces() {
        let (event_tx, addr, server_task) = serve().await;
        let mut socket = connect(&addr, "?agents=codex").await;
        tokio::time::sleep(Duration::from_millis(50)).await;

        event_tx
            .send(("cc-message".to_string(), json!({ "skipped": true })))
            .expect("publish cc event");
        event_tx
            .send(("codex:notification".to_string(), json!({ "kept": true })))
            .expect("publish codex event");

        let value = next_json(&mut socket).await;
        assert_eq!(value["event"], "codex:notification");
        // seq 1 was consumed by the filtered-out cc event: sequence numbers are
        // global, so a filtered client sees gaps and must not assume contiguity.
        assert_eq!(value["seq"], 2);

        server_task.abort();
    }
}
