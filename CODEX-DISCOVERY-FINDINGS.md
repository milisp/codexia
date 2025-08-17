# Codex CLI Discovery — Findings & Fixes

## Summary
Your current setup uses a symlink to make `codex` discoverable:

- `~/.cargo/bin/codex -> ~/.local/share/npm/lib/node_modules/@openai/codex/bin/codex-<platform>`

This works because our discovery logic checks `~/.cargo/bin/codex`. Without that symlink, discovery often fails on default (rootless) npm installations since we don’t search `~/.local/share/npm/lib/node_modules`. We also intentionally skip wrapper scripts (like `codex` shims) which further reduces discoverability.

Goal: Increase zero‑config discoverability for default installations so a symlink isn’t required.

## What Discovery Does Today
File: `src-tauri/src/utils/codex_discovery.rs`

- Prefers platform binary inside selected global node_modules roots:
  - `~/.bun/install/global/node_modules/@openai/codex/bin/<binary>`
  - `/usr/local/lib/node_modules/@openai/codex/bin/<binary>`
  - `/opt/homebrew/lib/node_modules/@openai/codex/bin/<binary>`
- Then tries “native” paths:
  - `~/.cargo/bin/codex`, `/usr/local/bin/codex`, `/opt/homebrew/bin/codex`
  - Skips wrapper scripts by reading the file as text and ignoring if it looks like a Node/JS shim
- Finally scans `PATH` for a non-wrapper `codex` (skips wrappers again)

## Where Default Global npm Actually Installs (rootless)
- Prefix: `~/.local/share/npm` (see `npm config get prefix`)
- Global node_modules: `~/.local/share/npm/lib/node_modules`
- Relevant path for platform binary:
  - `~/.local/share/npm/lib/node_modules/@openai/codex/bin/<binary>`
- Optional wrapper shim:
  - `~/.local/share/npm/bin/codex` (Node/JS entry)

Because we don’t currently look in `~/.local/share/npm/lib/node_modules`, discovery fails unless users add a symlink or configure a custom Codex path.

## Recommended Changes
1) Add the rootless npm global path
- Include: `~/.local/share/npm/lib/node_modules/@openai/codex/bin/<binary>` in the first (preferred) search list.

2) Accept wrapper scripts as a last-resort fallback
- Today we skip wrappers (Node/JS shims). They generally work fine for streaming. Keep the “prefer native binary” behavior, but if no platform binary is found, accept a wrapper:
  - `~/.local/share/npm/bin/codex`
  - `~/.bun/bin/codex`
  - Any `codex` found in PATH, even if it’s a wrapper

3) Look at common Node managers (best effort)
- NVM: `~/.nvm/versions/node/*/lib/node_modules/@openai/codex/bin/<binary>`
- Volta: `~/.volta/tools/image/node/*/lib/node_modules/@openai/codex/bin/<binary>`
- (Optional) PNPM global: `~/.local/share/pnpm/global/*/node_modules/@openai/codex/bin/<binary>`

4) Environment overrides
- Respect `CODEX_PATH` env var if provided (before discovery) — we already support user config via UI; an env opt-in helps headless/debug.

## Minimal Viable Patch (targeted, robust)
- Add the missing rootless npm path (fixes default install immediately)
- On PATH fallback, if nothing else found, allow wrappers (stop skipping them)

### Sketch: expand locations and allow wrappers as fallback
```rust
pub fn discover_codex_command() -> Option<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_default();
    let binary_name = get_platform_binary_name();

    // 0) Optional: honor CODEX_PATH
    if let Ok(explicit) = std::env::var("CODEX_PATH") {
        let p = PathBuf::from(explicit);
        if p.exists() { return Some(p); }
    }

    // 1) Preferred: platform binaries in common global node_modules
    let binary_locations = [
        format!("{}/.bun/install/global/node_modules/@openai/codex/bin/{}", home, binary_name),
        format!("{}/.local/share/npm/lib/node_modules/@openai/codex/bin/{}", home, binary_name), // NEW
        "/usr/local/lib/node_modules/@openai/codex/bin/".to_string() + binary_name,
        "/opt/homebrew/lib/node_modules/@openai/codex/bin/".to_string() + binary_name,
    ];
    for path in &binary_locations {
        let p = PathBuf::from(path);
        if p.exists() { return Some(p); }
    }

    // 2) Node managers (best effort)
    for base in [
        format!("{}/.nvm/versions/node", home),
        format!("{}/.volta/tools/image/node", home),
        format!("{}/.local/share/pnpm/global", home),
    ] {
        if let Ok(entries) = std::fs::read_dir(&base) {
            for entry in entries.flatten() {
                let candidate = entry.path().join("lib/node_modules/@openai/codex/bin").join(binary_name);
                if candidate.exists() { return Some(candidate); }
            }
        }
    }

    // 3) Native/symlink locations we already use
    let native_paths = [
        format!("{}/.cargo/bin/codex", home),
        format!("{}/.bun/bin/codex", home), // allow bun shim
        "/usr/local/bin/codex".into(),
        "/opt/homebrew/bin/codex".into(),
    ];
    for path in &native_paths {
        let p = PathBuf::from(path);
        if p.exists() { return Some(p); }
    }

    // 4) PATH: prefer native binaries (non-wrapper), else accept wrappers as last resort
    if let Ok(path_env) = std::env::var("PATH") {
        let sep = if cfg!(windows) { ';' } else { ':' };
        let exe = if cfg!(windows) { "codex.exe" } else { "codex" };
        let mut wrapper_candidate: Option<PathBuf> = None;
        for dir in path_env.split(sep).filter(|d| !d.is_empty()) {
            let cand = PathBuf::from(dir).join(exe);
            if !cand.exists() { continue; }
            if let Ok(content) = std::fs::read_to_string(&cand) {
                let is_wrapper = content.contains("codex.js") || content.starts_with("#!/usr/bin/env node");
                if is_wrapper { wrapper_candidate = Some(cand); continue; }
            }
            // Looks native
            return Some(cand);
        }
        if let Some(w) = wrapper_candidate { return Some(w); }
    }

    None
}
```

## Verification
- Remove the symlink and ensure detection succeeds on:
  - `~/.local/share/npm/lib/node_modules/@openai/codex/bin/<binary>`
  - If missing, confirm PATH shim like `~/.local/share/npm/bin/codex` gets picked up as fallback
- Log discovered path in `/tmp/codexia.log` for debugging (already done in `codex_client`)

## Optional UX Enhancements
- Surface a “Where I looked” diagnostic when discovery fails (list checked directories)
- Add settings hint: allow user to paste either the platform binary OR wrapper path; both should work reliably
- Consider supporting `npx -y @openai/codex` as a last-resort launcher (opt-in; can be slow on first run)

---
Implementing the minimal patch (rootless npm path + wrapper fallback) should eliminate the need for a symlink in default setups like this one.
