//! Process-local, short-lived bearer capabilities for the `codexia-bots` MCP
//! server: who is calling, whether it may ask other bots, and which session
//! the call comes from.
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const TTL: Duration = Duration::from_secs(60 * 60 * 8);

struct Entry {
    caller: String,
    ask: bool,
    session: Option<String>,
    expires: Instant,
}

/// What a valid capability allows.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Grant {
    /// May list and ask other bots. Off for a bot that was itself asked, so
    /// help stays one hop deep.
    pub ask: bool,
    /// The session the capability was handed to, once it is known.
    pub session: Option<String>,
}

static REGISTRY: OnceLock<Mutex<HashMap<String, Entry>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, Entry>> {
    REGISTRY.get_or_init(Mutex::default)
}

pub(crate) fn issue(caller: &str, ask: bool) -> String {
    let token = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    let mut entries = registry().lock().unwrap();
    entries.retain(|_, entry| entry.expires > Instant::now());
    entries.insert(
        token.clone(),
        Entry { caller: caller.to_string(), ask, session: None, expires: Instant::now() + TTL },
    );
    token
}

/// The grant behind `token`, when it is live and belongs to `caller`.
pub fn grant(token: &str, caller: &str) -> Option<Grant> {
    registry()
        .lock()
        .unwrap()
        .get(token)
        .filter(|entry| entry.caller == caller && entry.expires > Instant::now())
        .map(|entry| Grant { ask: entry.ask, session: entry.session.clone() })
}

pub fn verify(token: &str, caller: &str) -> bool {
    grant(token, caller).is_some()
}

/// Record which session a capability was handed to.
pub(crate) fn bind(token: &str, session_id: &str) {
    if let Some(entry) = registry().lock().unwrap().get_mut(token) {
        entry.session = Some(session_id.to_string());
    }
}

pub(crate) fn revoke(token: &str) {
    registry().lock().unwrap().remove(token);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capabilities_are_unique_bound_expiring_and_revocable() {
        let first = issue("caller", true);
        let second = issue("caller", false);
        assert_ne!(first, second);
        assert!(verify(&first, "caller"));
        assert!(!verify(&first, "forged"));
        assert!(!verify("", "caller"));
        assert!(!verify("invented", "caller"));
        assert_eq!(grant(&second, "caller"), Some(Grant { ask: false, session: None }));
        bind(&first, "s1");
        assert_eq!(grant(&first, "caller"), Some(Grant { ask: true, session: Some("s1".into()) }));
        revoke(&first);
        assert!(!verify(&first, "caller"));
        registry().lock().unwrap().get_mut(&second).unwrap().expires = Instant::now();
        assert!(!verify(&second, "caller"));
        revoke(&second);
    }
}
