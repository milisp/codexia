use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

fn codex_home() -> PathBuf {
    if let Some(path) = std::env::var_os("CODEX_HOME") {
        return PathBuf::from(path);
    }
    dirs::home_dir()
        .map(|home| home.join(".codex"))
        .unwrap_or_else(|| PathBuf::from(".codex"))
}

fn plugins_root_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Failed to resolve home directory".to_string())?;
    Ok(home.join(".agents").join("plugins"))
}

pub(crate) fn central_skills_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Failed to resolve home directory".to_string())?;
    Ok(home.join(".agents").join("skills"))
}

pub(crate) fn resolve_skills_install_root(
    selected_agent: &str,
    scope: &str,
    cwd: Option<&str>,
) -> Result<PathBuf, String> {
    let normalized_agent = selected_agent.trim().to_ascii_lowercase();
    if normalized_agent != "codex" && normalized_agent != "cc" {
        return Err(format!("Unsupported selected_agent: {}", selected_agent));
    }

    let normalized_scope = scope.trim().to_ascii_lowercase();
    if normalized_scope != "user" && normalized_scope != "project" {
        return Err(format!("Unsupported scope: {}", scope));
    }

    match (normalized_agent.as_str(), normalized_scope.as_str()) {
        ("codex", "user") => Ok(codex_home().join("skills")),
        ("codex", "project") => {
            let working_dir = cwd
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "cwd is required when scope is project".to_string())?;
            Ok(PathBuf::from(working_dir).join(".codex").join("skills"))
        }
        ("cc", "user") => {
            let home =
                dirs::home_dir().ok_or_else(|| "Failed to resolve home directory".to_string())?;
            Ok(home.join(".claude").join("skills"))
        }
        ("cc", "project") => {
            let working_dir = cwd
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "cwd is required when scope is project".to_string())?;
            Ok(PathBuf::from(working_dir).join(".claude").join("skills"))
        }
        _ => Err("Failed to resolve install root".to_string()),
    }
}

fn ensure_plugins_root(target: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(target).map_err(|err| {
        format!(
            "Failed to create plugins root directory {}: {}",
            target.display(),
            err
        )
    })
}

fn repo_subpath_from_url(url: &str) -> Result<PathBuf, String> {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Invalid repository url".to_string());
    }

    let path_part = if let Some((_, rest)) = trimmed.split_once("://") {
        rest.split_once('/').map(|(_, path)| path).unwrap_or("")
    } else if let Some((_, rest)) = trimmed.split_once(':') {
        rest
    } else {
        trimmed
    };

    let segments = path_part
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();

    if segments.is_empty() {
        return Err("Could not derive repository name from url".to_string());
    }

    let repo = segments
        .last()
        .ok_or_else(|| "Could not derive repository name from url".to_string())?
        .trim_end_matches(".git");

    if repo.is_empty() {
        return Err("Could not derive repository name from url".to_string());
    }

    if segments.len() >= 2 {
        let owner = segments[segments.len() - 2];
        if !owner.is_empty() {
            return Ok(PathBuf::from(owner).join(repo));
        }
    }

    Ok(PathBuf::from(repo))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceSkill {
    pub name: String,
    pub description: Option<String>,
    pub license: Option<String>,
    pub skill_md_path: String,
    pub source_dir_path: String,
    pub installed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledSkill {
    pub name: String,
    pub path: String,
    pub skill_md_path: Option<String>,
    pub description: Option<String>,
}

/// A skill that lives in the central store (~/.agents/skills/).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CentralSkill {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    /// Whether a link exists in the codex agent skills directory.
    pub linked_codex: bool,
    /// Whether a link exists in the cc agent skills directory.
    pub linked_cc: bool,
}

#[derive(Debug, Default)]
pub(crate) struct SkillFrontMatter {
    pub(crate) name: Option<String>,
    pub(crate) description: Option<String>,
    pub(crate) license: Option<String>,
}

fn parse_field(line: &str, key: &str) -> Option<Option<String>> {
    let trimmed = line.trim();
    let lower = trimmed.to_lowercase();
    if lower == key {
        return Some(Some(String::new()));
    }
    if !lower.starts_with(&(key.to_string() + ":")) {
        return None;
    }
    let (_, value) = trimmed.split_once(':').unwrap_or((trimmed, ""));
    let parsed = value.trim().trim_matches('"').trim_matches('\'');
    if parsed.is_empty() {
        return Some(Some(String::new()));
    }
    Some(Some(parsed.to_string()))
}

pub(crate) fn parse_skill_front_matter(path: &std::path::Path) -> Result<SkillFrontMatter, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|err| format!("Failed to read {}: {}", path.display(), err))?;
    let mut front_matter = SkillFrontMatter::default();
    for line in content.lines().take(5) {
        if front_matter.name.is_none()
            && let Some(value) = parse_field(line, "name")
        {
            front_matter.name = value;
            continue;
        }
        if front_matter.description.is_none()
            && let Some(value) = parse_field(line, "description")
        {
            front_matter.description = value;
            continue;
        }
        if front_matter.license.is_none()
            && let Some(value) = parse_field(line, "license")
        {
            front_matter.license = value;
            continue;
        }
    }
    Ok(front_matter)
}

fn path_contains_skills_segment(path: &std::path::Path) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_string_lossy()
            .eq_ignore_ascii_case("skills")
    })
}

fn collect_skill_md_files(dir: &std::path::Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    let entries = std::fs::read_dir(dir)
        .map_err(|err| format!("Failed to read directory {}: {}", dir.display(), err))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("Failed to read directory entry: {}", err))?;
        let path = entry.path();
        if path.is_dir() {
            collect_skill_md_files(&path, output)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let filename_matches = path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case("SKILL.md"))
            .unwrap_or(false);
        if filename_matches && path_contains_skills_segment(&path) {
            output.push(path);
        }
    }
    Ok(())
}

fn scan_marketplace_skills() -> Result<Vec<MarketplaceSkill>, String> {
    let plugins_root = plugins_root_dir()?;
    if !plugins_root.exists() {
        return Ok(Vec::new());
    }
    // Check installed state against the central store, not a specific agent dir.
    let central_dir = central_skills_dir()?;

    let mut skill_files = Vec::new();
    collect_skill_md_files(&plugins_root, &mut skill_files)?;

    let mut skills = Vec::new();
    for skill_md in skill_files {
        let source_dir = match skill_md.parent() {
            Some(dir) => dir,
            None => continue,
        };
        let front_matter = parse_skill_front_matter(&skill_md)?;
        let fallback_name = source_dir
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .trim()
            .to_string();
        let resolved_name = front_matter.name.unwrap_or(fallback_name);
        if resolved_name.is_empty() {
            continue;
        }
        let installed = central_dir.join(&resolved_name).join("SKILL.md").is_file();
        skills.push(MarketplaceSkill {
            name: resolved_name,
            description: front_matter.description.filter(|value| !value.is_empty()),
            license: front_matter.license.filter(|value| !value.is_empty()),
            skill_md_path: skill_md.to_string_lossy().to_string(),
            source_dir_path: source_dir.to_string_lossy().to_string(),
            installed,
        });
    }

    skills.sort_by_key(|a| a.name.to_lowercase());
    Ok(skills)
}

fn scan_installed_skills(install_root: &Path) -> Result<Vec<InstalledSkill>, String> {
    if !install_root.exists() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(install_root).map_err(|err| {
        format!(
            "Failed to read directory {}: {}",
            install_root.display(),
            err
        )
    })?;

    let mut skills = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|err| format!("Failed to read directory entry: {}", err))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if name.is_empty() {
            continue;
        }
        let skill_md = path.join("SKILL.md");
        if !skill_md.is_file() {
            continue;
        }
        let front_matter = parse_skill_front_matter(&skill_md)?;
        let skill_md_path = Some(skill_md.to_string_lossy().to_string());
        let description = front_matter.description.filter(|value| !value.is_empty());

        skills.push(InstalledSkill {
            name,
            path: path.to_string_lossy().to_string(),
            skill_md_path,
            description,
        });
    }
    skills.sort_by_key(|a| a.name.to_lowercase());
    Ok(skills)
}

pub(crate) fn copy_dir_recursive(from: &std::path::Path, to: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(to)
        .map_err(|err| format!("Failed to create directory {}: {}", to.display(), err))?;
    let entries = std::fs::read_dir(from)
        .map_err(|err| format!("Failed to read directory {}: {}", from.display(), err))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("Failed to read directory entry: {}", err))?;
        let source_path = entry.path();
        let target_path = to.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else if source_path.is_file() {
            std::fs::copy(&source_path, &target_path).map_err(|err| {
                format!(
                    "Failed to copy {} to {}: {}",
                    source_path.display(),
                    target_path.display(),
                    err
                )
            })?;
        }
    }
    Ok(())
}

/// On Unix: create a symlink `target -> source`.
/// On other platforms: fall back to a full directory copy.
pub(crate) fn link_skill(source: &std::path::Path, target: &std::path::Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(source, target).map_err(|err| {
            format!(
                "Failed to create symlink {} -> {}: {}",
                target.display(),
                source.display(),
                err
            )
        })
    }
    #[cfg(not(unix))]
    {
        copy_dir_recursive(source, target)
    }
}

/// Remove a skill link (symlink or copied directory) without touching the central store.
fn remove_skill_link(target: &std::path::Path) -> Result<(), String> {
    if target.is_symlink() {
        std::fs::remove_file(target)
            .map_err(|err| format!("Failed to remove symlink {}: {}", target.display(), err))
    } else if target.is_dir() {
        std::fs::remove_dir_all(target)
            .map_err(|err| format!("Failed to remove {}: {}", target.display(), err))
    } else {
        Ok(())
    }
}

pub async fn list_marketplace_skills() -> Result<Vec<MarketplaceSkill>, String> {
    tokio::task::spawn_blocking(scan_marketplace_skills)
        .await
        .map_err(|err| format!("List marketplace skills task failed: {}", err))?
}

pub async fn list_installed_skills(
    selected_agent: String,
    scope: String,
    cwd: Option<String>,
) -> Result<Vec<InstalledSkill>, String> {
    tokio::task::spawn_blocking(move || {
        let install_root = resolve_skills_install_root(&selected_agent, &scope, cwd.as_deref())?;
        scan_installed_skills(&install_root)
    })
    .await
    .map_err(|err| format!("List installed skills task failed: {}", err))?
}

pub async fn install_marketplace_skill(
    skill_md_path: String,
    skill_name: String,
    selected_agent: String,
    scope: String,
    cwd: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let requested_name = skill_name.trim();
        if requested_name.is_empty() {
            return Err("skill_name cannot be empty".to_string());
        }
        if requested_name.contains('/') || requested_name.contains('\\') {
            return Err("skill_name cannot contain path separators".to_string());
        }
        let source_skill_md = PathBuf::from(skill_md_path.trim());
        if !source_skill_md.exists() || !source_skill_md.is_file() {
            return Err(format!(
                "SKILL.md path does not exist: {}",
                source_skill_md.display()
            ));
        }
        let filename_valid = source_skill_md
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case("SKILL.md"))
            .unwrap_or(false);
        if !filename_valid {
            return Err("skill_md_path must point to SKILL.md".to_string());
        }
        let source_dir = source_skill_md.parent().ok_or_else(|| {
            format!(
                "Failed to resolve source directory for {}",
                source_skill_md.display()
            )
        })?;

        // Step 1: install into central store (~/.agents/skills/<name>/)
        let central_dir = central_skills_dir()?;
        std::fs::create_dir_all(&central_dir).map_err(|err| {
            format!(
                "Failed to create central skills directory {}: {}",
                central_dir.display(),
                err
            )
        })?;
        let central_skill_dir = central_dir.join(requested_name);
        if !central_skill_dir.exists() {
            copy_dir_recursive(source_dir, &central_skill_dir)?;
        }

        // Step 2: link central skill into the agent's skills directory
        let install_root = resolve_skills_install_root(&selected_agent, &scope, cwd.as_deref())?;
        std::fs::create_dir_all(&install_root).map_err(|err| {
            format!(
                "Failed to create agent skills directory {}: {}",
                install_root.display(),
                err
            )
        })?;
        let target_dir = install_root.join(requested_name);
        if target_dir.exists() || target_dir.is_symlink() {
            return Ok(target_dir.to_string_lossy().to_string());
        }
        link_skill(&central_skill_dir, &target_dir)?;
        Ok(target_dir.to_string_lossy().to_string())
    })
    .await
    .map_err(|err| format!("Install marketplace skill task failed: {}", err))?
}

pub async fn uninstall_installed_skill(
    skill_name: String,
    selected_agent: String,
    scope: String,
    cwd: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let requested_name = skill_name.trim();
        if requested_name.is_empty() {
            return Err("skill_name cannot be empty".to_string());
        }
        if requested_name.contains('/') || requested_name.contains('\\') {
            return Err("skill_name cannot contain path separators".to_string());
        }

        let install_root = resolve_skills_install_root(&selected_agent, &scope, cwd.as_deref())?;
        let target_dir = install_root.join(requested_name);
        // Remove the agent link only; the central store (~/.agents/skills/) is kept intact
        remove_skill_link(&target_dir)?;
        Ok(target_dir.to_string_lossy().to_string())
    })
    .await
    .map_err(|err| format!("Uninstall installed skill task failed: {}", err))?
}

/// List all skills in the central store with per-agent link status.
pub async fn list_central_skills(
    scope: String,
    cwd: Option<String>,
) -> Result<Vec<CentralSkill>, String> {
    tokio::task::spawn_blocking(move || {
        let central_dir = central_skills_dir()?;
        if !central_dir.exists() {
            return Ok(Vec::new());
        }
        let codex_root = resolve_skills_install_root("codex", &scope, cwd.as_deref())?;
        let cc_root = resolve_skills_install_root("cc", &scope, cwd.as_deref())?;

        let entries = std::fs::read_dir(&central_dir)
            .map_err(|err| format!("Failed to read central skills dir: {}", err))?;

        let mut skills = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|err| format!("Failed to read entry: {}", err))?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if name.is_empty() {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            if !skill_md.is_file() {
                continue;
            }
            let front_matter = parse_skill_front_matter(&skill_md)?;
            let description = front_matter.description.filter(|v| !v.is_empty());
            let codex_link = codex_root.join(&name);
            let cc_link = cc_root.join(&name);
            skills.push(CentralSkill {
                name,
                path: path.to_string_lossy().to_string(),
                description,
                linked_codex: codex_link.exists() || codex_link.is_symlink(),
                linked_cc: cc_link.exists() || cc_link.is_symlink(),
            });
        }
        skills.sort_by_key(|a| a.name.to_lowercase());
        Ok(skills)
    })
    .await
    .map_err(|err| format!("List central skills task failed: {}", err))?
}

/// Create a link from the central store to the given agent's skills directory.
pub async fn link_skill_to_agent(
    skill_name: String,
    agent: String,
    scope: String,
    cwd: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let requested_name = skill_name.trim();
        if requested_name.is_empty() {
            return Err("skill_name cannot be empty".to_string());
        }
        let central_skill_dir = central_skills_dir()?.join(requested_name);
        if !central_skill_dir.exists() {
            return Err(format!(
                "Skill '{}' not found in central store",
                requested_name
            ));
        }
        let agent_root = resolve_skills_install_root(&agent, &scope, cwd.as_deref())?;
        std::fs::create_dir_all(&agent_root).map_err(|err| {
            format!(
                "Failed to create agent skills directory {}: {}",
                agent_root.display(),
                err
            )
        })?;
        let target = agent_root.join(requested_name);
        if target.exists() || target.is_symlink() {
            return Ok(());
        }
        link_skill(&central_skill_dir, &target)
    })
    .await
    .map_err(|err| format!("Link skill task failed: {}", err))?
}

/// Remove a skill entirely from the central store and all agent links.
pub async fn delete_central_skill(
    skill_name: String,
    scope: String,
    cwd: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let requested_name = skill_name.trim();
        if requested_name.is_empty() {
            return Err("skill_name cannot be empty".to_string());
        }
        // Remove agent links first
        for agent in &["codex", "cc"] {
            if let Ok(root) = resolve_skills_install_root(agent, &scope, cwd.as_deref()) {
                remove_skill_link(&root.join(requested_name)).ok();
            }
        }
        // Remove central copy
        let central = central_skills_dir()?.join(requested_name);
        if central.exists() {
            std::fs::remove_dir_all(&central).map_err(|err| {
                format!("Failed to remove central skill {}: {}", central.display(), err)
            })?;
        }
        Ok(())
    })
    .await
    .map_err(|err| format!("Delete central skill task failed: {}", err))?
}

// ── Skill Groups ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillGroup {
    pub id: String,
    pub name: String,
    pub skill_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillGroupsConfig {
    pub groups: Vec<SkillGroup>,
}

fn skill_groups_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Failed to resolve home directory".to_string())?;
    Ok(home.join(".agents").join("skill-groups.json"))
}

pub async fn read_skill_groups() -> Result<SkillGroupsConfig, String> {
    tokio::task::spawn_blocking(move || {
        let path = skill_groups_path()?;
        if !path.exists() {
            return Ok(SkillGroupsConfig::default());
        }
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read skill-groups.json: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse skill-groups.json: {}", e))
    })
    .await
    .map_err(|e| format!("read_skill_groups task failed: {}", e))?
}

pub async fn write_skill_groups(config: SkillGroupsConfig) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = skill_groups_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        let content = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize skill groups: {}", e))?;
        std::fs::write(&path, content)
            .map_err(|e| format!("Failed to write skill-groups.json: {}", e))
    })
    .await
    .map_err(|e| format!("write_skill_groups task failed: {}", e))?
}

pub async fn clone_skills_repo(url: String) -> Result<String, String> {
    let clone_url = url.trim().to_string();
    if clone_url.is_empty() {
        return Err("url cannot be empty".to_string());
    }
    let repo_subpath = repo_subpath_from_url(&clone_url)?;
    let plugins_root = plugins_root_dir()?;
    ensure_plugins_root(&plugins_root)?;
    let target = plugins_root.join(&repo_subpath);

    let target_for_clone = target.clone();
    let clone_result = tokio::task::spawn_blocking(move || {
        codexia_git::clone(&clone_url, &target_for_clone)
    })
    .await
    .map_err(|err| format!("Clone task failed: {}", err))?;

    let actual_path = match clone_result {
        Ok(path) => path,
        Err(err) => {
            let message = format!("Failed to clone repository: {}", err);
            eprintln!("[git-command] clone failed: {}", err);
            return Err(message);
        }
    };

    let open_path = actual_path.clone();
    let verify_result = tokio::task::spawn_blocking(move || {
        gix::open(&open_path)
            .map(drop)
            .map_err(|err| err.to_string())
    })
    .await
    .map_err(|err| format!("Repository verification task failed: {}", err))?;
    if let Err(err) = verify_result {
        let message = format!(
            "Clone finished but gix could not open repository at {}: {}",
            actual_path.display(),
            err
        );
        eprintln!("[git-command] verify failed: {}", err);
        return Err(message);
    }

    Ok(actual_path.to_string_lossy().to_string())
}
