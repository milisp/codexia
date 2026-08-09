//! Generic Agent Client Protocol (ACP) client.
//!
//! Speaks JSON-RPC 2.0 over a child process' stdio, so any ACP-capable agent
//! (Gemini CLI, Hermes, Claude Code ACP, ...) can be driven from one UI.

pub mod agents;
pub mod client;
pub mod state;

pub use agents::{AcpAgentDef, find_preset, list_agents};
pub use client::{ACP_EVENT, AcpClient};
pub use state::{AcpStartResult, AcpState};
