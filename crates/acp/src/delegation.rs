//! Process-local, short-lived bearer capabilities for bot delegation.
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const TTL: Duration = Duration::from_secs(60 * 60 * 8);
static REGISTRY: OnceLock<Mutex<HashMap<String, (String, Instant)>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, (String, Instant)>> {
    REGISTRY.get_or_init(Mutex::default)
}

pub(crate) fn issue(caller: &str) -> String {
    let token = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    let mut entries = registry().lock().unwrap();
    entries.retain(|_, (_, expires)| *expires > Instant::now());
    entries.insert(token.clone(), (caller.to_string(), Instant::now() + TTL));
    token
}

pub fn verify(token: &str, caller: &str) -> bool {
    registry().lock().unwrap().get(token)
        .is_some_and(|(owner, expires)| owner == caller && *expires > Instant::now())
}

pub(crate) fn revoke(token: &str) {
    registry().lock().unwrap().remove(token);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capabilities_are_unique_bound_expiring_and_revocable() {
        let first = issue("caller");
        let second = issue("caller");
        assert_ne!(first, second);
        assert!(verify(&first, "caller"));
        assert!(!verify(&first, "forged"));
        assert!(!verify("", "caller"));
        assert!(!verify("invented", "caller"));
        revoke(&first);
        assert!(!verify(&first, "caller"));
        registry().lock().unwrap().get_mut(&second).unwrap().1 = Instant::now();
        assert!(!verify(&second, "caller"));
        revoke(&second);
    }
}
