# .codex/config.toml Detection & Projects UI – Findings and Fix

## Summary
- The app reads `~/.codex/config.toml` and deserializes the entire file into a Rust `CodexConfig`.
- The file contained `mcp_servers` entries missing the required `type` field, causing TOML deserialization to fail.
- Because `read_codex_config` parses the whole file (including `mcp_servers`), the parse error prevented the Projects list from loading, resulting in a blank Projects UI.
- Adding `type = "stdio"` to each `[mcp_servers.*]` entry fixed the parse and the Projects page now loads as expected.

## Detection & Flow
- Config path: `src-tauri/src/config.rs::get_config_path()` resolves to `~/.codex/config.toml`.
- Projects UI loads projects via `src/pages/projects.tsx` calling `invoke("read_codex_config")`.
- Rust command `read_codex_config` parses the full `CodexConfig` and then maps `projects` to a vector for the UI.

## Root Cause
- Rust `McpServerConfig` is a tagged enum using `#[serde(tag = "type")]`:
  - `type = "stdio"` with `command`, `args`, optional `env`.
  - `type = "http"` with `url`.
- `~/.codex/config.toml` had `[mcp_servers.*]` tables without a `type` field. TOML deserialization failed with “Failed to parse config file: …”. The UI then logged an error and displayed no projects.

## Fix Applied (Config Change)
Updated `~/.codex/config.toml` to include `type = "stdio"` for all stdio-based servers:

```toml
[mcp_servers.Context7]
type = "stdio"
command = "npx"
args = ["-y", "@upstash/context7-mcp@latest"]

[mcp_servers.openmemory]
type = "stdio"
command = "mcp-proxy"
args = ["http://localhost:8765/mcp/codex-cli/sse/drj"]

[mcp_servers.playwright]
type = "stdio"
command = "npx"
args = ["@playwright/mcp@latest", "--browser=chrome", "--extension"]
env = {}

[mcp_servers.code_index]
type = "stdio"
command = "uvx"
args = ["code-index-mcp"]
```

Note: For any HTTP-based server (with `url`), use `type = "http"` instead.

## Recommended Code Hardening

1) Parse Projects Independently
- Prevent unrelated MCP config errors from blocking the Projects list.
- Change `read_codex_config` to only parse the `[projects]` table (or parse full config but fall back to projects-only on error).

Example approach:

```rust
// src-tauri/src/config.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    #[serde(default = "default_trust")] // default to avoid hard failures on missing trust_level
    pub trust_level: String,
}

fn default_trust() -> String { "untrusted".into() }

#[derive(Deserialize)]
struct ProjectsOnly {
    #[serde(default)]
    projects: HashMap<String, ProjectConfig>,
}

#[tauri::command]
pub async fn read_codex_config() -> Result<Vec<Project>, String> {
    let config_path = get_config_path()?;
    if !config_path.exists() { return Ok(vec![]); }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    // Parse only the projects table to avoid failures from mcp_servers
    let cfg: ProjectsOnly = toml::from_str(&content)
        .map_err(|e| format!("Failed to parse projects: {}", e))?;

    Ok(cfg.projects.into_iter().map(|(path, p)| Project {
        path,
        trust_level: p.trust_level,
    }).collect())
}
```

2) Make MCP Server Parsing Tolerant
- Option A: Custom `Deserialize` to infer `type` when missing (detect `url` → `http`, or `command/args` → `stdio`).
- Option B: Parse MCP servers via `toml::Value`, then coerce to a struct with the `type` field set explicitly before returning to the UI.

Example idea (sketch):

```rust
#[tauri::command]
pub async fn read_mcp_servers() -> Result<HashMap<String, McpServerConfig>, String> {
    let path = get_config_path()?;
    if !path.exists() { return Ok(HashMap::new()); }
    let content = fs::read_to_string(&path).map_err(|e| format!("read: {}", e))?;

    let value: toml::Value = toml::from_str(&content).map_err(|e| format!("parse: {}", e))?;
    let servers = value.get("mcp_servers").and_then(|v| v.as_table()).ok_or("no mcp_servers")?;

    let mut out = HashMap::new();
    for (name, raw) in servers {
        let mut tbl = raw.clone();
        let is_http = tbl.get("url").is_some();
        let has_cmd = tbl.get("command").is_some();
        if tbl.get("type").is_none() {
            let ty = if is_http { "http" } else if has_cmd { "stdio" } else { "stdio" };
            tbl.as_table_mut().unwrap().insert("type".into(), toml::Value::String(ty.into()));
        }
        // Now deserialize after ensuring type exists
        let cfg: McpServerConfig = tbl.try_into().map_err(|e| format!("mcp '{}': {}", name, e))?;
        out.insert(name.clone(), cfg);
    }
    Ok(out)
}
```

3) Improve UI Error Visibility
- In `src/pages/projects.tsx`, surface parse errors (e.g., toast/banner) instead of silently showing an empty list.

## Validation
- After adding `type = "stdio"` for stdio-based MCP servers, the config deserialization succeeds and Projects are displayed.
- This confirms the detection logic and path resolution are correct; the issue was strict deserialization of `mcp_servers`.

## Notes
- Unknown keys like `[mcp_servers.Context7.headers]` are tolerated by Serde unless `deny_unknown_fields` is specified, so they do not cause failures.
- Keeping config parsing resilient reduces support burden and prevents UI regressions from unrelated config changes.

