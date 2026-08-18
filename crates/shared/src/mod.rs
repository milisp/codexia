// Pure utility modules live in the codexia-shared crate to keep them
// usable by the standalone web binary without a circular dependency.
pub use codexia_shared::event_sink;
pub use codexia_shared::fs;
pub use codexia_shared::insights;
pub use codexia_shared::skills;
pub use codexia_shared::skillssh;
pub use codexia_shared::sleep;
pub use codexia_shared::terminal;

// Modules that depend on cc/codex/db stay here to avoid a cycle.
pub mod automation;
pub mod mcp;
#[cfg(feature = "desktop")]
pub mod p2p_bridge;
