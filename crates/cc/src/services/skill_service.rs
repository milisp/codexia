use std::fs;
use std::path::Path;

/// Built-in slash commands shipped with Claude Code CLI.
/// This list is a reasonable default; the authoritative set is delivered by
/// System::init when a session starts and will override this in the store.
const BUILTIN_SLASH_COMMANDS: &[&str] = &[
    "clear",
    "compact",
    "context",
    "cost",
    "help",
    "init",
    "login",
    "logout",
    "model",
    "pr-comments",
    "release-notes",
    "review",
    "todos",
];

/// Scan a `commands/` subdirectory and collect names from `*.md` files.
fn scan_commands_dir(dir: &Path, out: &mut Vec<String>) {
    if !dir.is_dir() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md")
                && let Some(stem) = path.file_stem().and_then(|s| s.to_str())
            {
                out.push(stem.to_string());
            }
        }
    }
}

/// Return all slash commands visible without a running session:
/// built-in defaults + user-level `~/.claude/commands/*.md`
/// + project-level `<cwd>/.claude/commands/*.md`.
pub fn get_slash_commands(cwd: Option<&str>) -> Result<Vec<String>, String> {
    let mut commands: Vec<String> = BUILTIN_SLASH_COMMANDS
        .iter()
        .map(|s| s.to_string())
        .collect();

    // User-level custom commands
    if let Some(home) = dirs::home_dir() {
        scan_commands_dir(&home.join(".claude").join("commands"), &mut commands);
    }

    // Project-level custom commands
    if let Some(cwd_str) = cwd
        && !cwd_str.is_empty()
    {
        scan_commands_dir(
            &Path::new(cwd_str).join(".claude").join("commands"),
            &mut commands,
        );
    }

    commands.sort();
    commands.dedup();
    Ok(commands)
}

pub fn get_installed_skills() -> Result<Vec<String>, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let skills_dir = home.join(".claude").join("skills");

    if !skills_dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = Vec::new();

    for entry in
        fs::read_dir(&skills_dir).map_err(|e| format!("Failed to read skills dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            // Check if SKILL.md exists
            if path.join("SKILL.md").exists()
                && let Some(name) = path.file_name().and_then(|n| n.to_str())
            {
                skills.push(name.to_string());
            }
        }
    }

    skills.sort();
    Ok(skills)
}
