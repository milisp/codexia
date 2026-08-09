use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{ConnectInfo, Request, State as AxumState},
    http::{HeaderMap, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};

/// Shared secret a remote client must present to reach the API.
///
/// The server exposes real capability over the network — starting shells,
/// reading and writing files, driving agents — so anything that is not the
/// local machine has to authenticate. Generated once and persisted so a device
/// paired against this desktop keeps working across restarts.
#[derive(Clone)]
pub struct DeviceToken {
    token: Arc<String>,
}

fn token_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Failed to resolve home directory".to_string())?;
    Ok(home.join(".codexia").join("device-token"))
}

fn generate_token() -> String {
    // Two v4 UUIDs (~244 bits from the OS CSPRNG), hex only so the token is
    // easy to retype or paste into a mobile client.
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

/// Compares two tokens without leaking their common prefix through timing.
fn constant_time_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

impl DeviceToken {
    /// Loads the persisted token, generating and storing one on first run.
    pub fn load_or_create() -> Result<Self, String> {
        let path = token_path()?;

        if let Ok(existing) = std::fs::read_to_string(&path) {
            let trimmed = existing.trim();
            if !trimmed.is_empty() {
                return Ok(Self { token: Arc::new(trimmed.to_string()) });
            }
        }

        let token = generate_token();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create {}: {e}", parent.display()))?;
        }
        std::fs::write(&path, &token)
            .map_err(|e| format!("Failed to write {}: {e}", path.display()))?;

        // Owner-only: the token is equivalent to shell access on this machine.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Err(e) =
                std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            {
                log::warn!("[auth] could not restrict permissions on {}: {e}", path.display());
            }
        }

        log::info!("[auth] generated a new device token at {}", path.display());
        Ok(Self { token: Arc::new(token) })
    }

    pub fn value(&self) -> &str {
        &self.token
    }

    fn matches(&self, candidate: &str) -> bool {
        constant_time_eq(&self.token, candidate)
    }
}

/// Reads the token from the `Authorization: Bearer` header, falling back to a
/// `token` query parameter.
///
/// The query fallback exists for `EventSource`, which cannot set headers — the
/// SSE stream would otherwise be unreachable for remote clients.
fn presented_token(headers: &HeaderMap, query: Option<&str>) -> Option<String> {
    let bearer = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|v| v.trim().to_string());

    if bearer.is_some() {
        return bearer;
    }

    let query = query?;
    query.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        (key == "token").then(|| value.to_string())
    })
}

fn is_loopback(addr: &SocketAddr) -> bool {
    match addr.ip() {
        IpAddr::V4(ip) => ip.is_loopback(),
        IpAddr::V6(ip) => ip.is_loopback(),
    }
}

/// Whether the `Host` header names the loopback interface.
///
/// Checked alongside the peer address so a malicious page cannot use DNS
/// rebinding — pointing its own hostname at 127.0.0.1 — to reach the API from
/// the browser with the loopback exemption applied.
fn host_is_loopback(headers: &HeaderMap) -> bool {
    let Some(host) = headers.get(header::HOST).and_then(|v| v.to_str().ok()) else {
        return false;
    };
    let hostname = match host.rsplit_once(':') {
        // Strip the port, taking care not to mangle a bare IPv6 literal.
        Some((name, port)) if port.chars().all(|c| c.is_ascii_digit()) => name,
        _ => host,
    };
    matches!(
        hostname.trim_matches(['[', ']']),
        "localhost" | "127.0.0.1" | "::1"
    )
}

/// Rejects requests that are neither local nor carrying a valid device token.
pub async fn require_device_token(
    AxumState(token): AxumState<DeviceToken>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let headers = request.headers();

    // A process on this machine can already do everything the API offers, so
    // requiring a token locally would add friction without adding safety.
    if is_loopback(&peer) && host_is_loopback(headers) {
        return next.run(request).await;
    }

    let presented = presented_token(headers, request.uri().query());
    match presented {
        Some(candidate) if token.matches(&candidate) => next.run(request).await,
        _ => {
            log::warn!(
                "[auth] rejected unauthenticated request from {peer} to {}",
                request.uri().path()
            );
            (
                StatusCode::UNAUTHORIZED,
                [(header::WWW_AUTHENTICATE, "Bearer")],
                "device token required",
            )
                .into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(header::HeaderName, &str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(name.clone(), HeaderValue::from_str(value).expect("valid header"));
        }
        map
    }

    #[test]
    fn constant_time_eq_matches_string_equality() {
        assert!(constant_time_eq("abc", "abc"));
        assert!(!constant_time_eq("abc", "abd"));
        assert!(!constant_time_eq("abc", "ab"));
        assert!(!constant_time_eq("", "a"));
        assert!(constant_time_eq("", ""));
    }

    #[test]
    fn generated_tokens_are_long_and_unique() {
        let a = generate_token();
        let b = generate_token();
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

    #[test]
    fn bearer_header_is_preferred() {
        let map = headers(&[(header::AUTHORIZATION, "Bearer secret")]);
        assert_eq!(presented_token(&map, Some("token=other")), Some("secret".into()));
    }

    #[test]
    fn query_parameter_is_used_when_no_header_present() {
        let map = HeaderMap::new();
        assert_eq!(presented_token(&map, Some("since=4&token=abc")), Some("abc".into()));
        assert_eq!(presented_token(&map, Some("since=4")), None);
        assert_eq!(presented_token(&map, None), None);
    }

    #[test]
    fn non_bearer_authorization_is_ignored() {
        let map = headers(&[(header::AUTHORIZATION, "Basic abc")]);
        assert_eq!(presented_token(&map, None), None);
    }

    #[test]
    fn loopback_host_header_accepts_local_names_with_and_without_port() {
        for value in ["localhost:7420", "127.0.0.1:7420", "localhost", "127.0.0.1", "[::1]:7420"] {
            let map = headers(&[(header::HOST, value)]);
            assert!(host_is_loopback(&map), "expected {value} to be loopback");
        }
    }

    #[test]
    fn loopback_host_header_rejects_rebound_names() {
        // A DNS-rebinding attacker resolves their own hostname to 127.0.0.1;
        // the peer address looks local but the Host header gives them away.
        for value in ["evil.example.com", "evil.example.com:7420", "codexia.ts.net"] {
            let map = headers(&[(header::HOST, value)]);
            assert!(!host_is_loopback(&map), "expected {value} to be rejected");
        }
        assert!(!host_is_loopback(&HeaderMap::new()));
    }

    #[test]
    fn token_matching_is_exact() {
        let token = DeviceToken { token: Arc::new("abc123".into()) };
        assert!(token.matches("abc123"));
        assert!(!token.matches("abc124"));
        assert!(!token.matches("abc"));
        assert!(!token.matches(""));
    }
}
