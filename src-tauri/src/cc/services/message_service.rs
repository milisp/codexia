use crate::cc::state::CCState;
use claude_agent_sdk_rs::{Message, UserContentBlock};
use futures::StreamExt;

fn image_path_to_content_block(path: &str) -> Result<UserContentBlock, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read image {path}: {e}"))?;
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
    UserContentBlock::image_base64(mime, &b64).map_err(|e| e.to_string())
}

pub(crate) async fn send_message_and_wait(
    session_id: &str,
    message: &str,
    image_paths: &[String],
    state: &CCState,
    mut message_callback: impl FnMut(Message) + Send,
) -> Result<(), String> {
    let client = state
        .get_client(session_id)
        .await
        .ok_or("Client not found")?;

    {
        let mut client = client.write().await;
        client.connect().await.map_err(|e| e.to_string())?;
    }

    if image_paths.is_empty() {
        let mut client = client.write().await;
        client.query_with_session(message, session_id).await.map_err(|e| e.to_string())?;
    } else {
        let mut content: Vec<UserContentBlock> = Vec::new();
        if !message.is_empty() {
            content.push(UserContentBlock::text(message));
        }
        for path in image_paths {
            content.push(image_path_to_content_block(path)?);
        }
        if content.is_empty() {
            content.push(UserContentBlock::text(""));
        }
        let mut client = client.write().await;
        client.query_with_content_and_session(content, session_id).await.map_err(|e| e.to_string())?;
    }

    loop {
        let result = {
            // Use a read lock so interrupt() can acquire a concurrent read lock
            let client = client.read().await;
            let mut stream = client.receive_response();
            stream.next().await
        };

        match result {
            Some(Ok(msg)) => {
                message_callback(msg.clone());
                if matches!(msg, Message::Result(_)) {
                    break;
                }
            }
            Some(Err(e)) => return Err(e.to_string()),
            None => break,
        }
    }

    Ok(())
}

pub async fn send_message(
    session_id: &str,
    message: &str,
    image_paths: &[String],
    state: &CCState,
    message_callback: impl Fn(Message) + Send + 'static,
) -> Result<(), String> {
    if state.get_client(session_id).await.is_none() {
        return Err("Client not found".to_string());
    }

    let session_id_owned = session_id.to_string();
    let message_owned = message.to_string();
    let image_paths_owned = image_paths.to_vec();
    let state_cloned = state.clone();

    tokio::spawn(async move {
        if let Err(err) = send_message_and_wait(
            &session_id_owned,
            &message_owned,
            &image_paths_owned,
            &state_cloned,
            message_callback,
        )
        .await
        {
            log::error!("Error sending/receiving message: {}", err);
        }
    });

    Ok(())
}
