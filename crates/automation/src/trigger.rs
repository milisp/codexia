//! Event triggers: start a task when something changes on this machine.
//!
//! Each trigger is polled while Codexia runs: local ones (a git ref, a folder)
//! every [`LOCAL_POLL`], GitHub ones through the `gh` CLI every [`GH_POLL`].
//! The first look at a trigger only records where things stand, so creating a
//! task or restarting the app never fires on what was already there, and what
//! changed while the app was closed is not replayed.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::process::Command;

use super::execution::execute_task_for_event;
use super::model::{AutomationTask, AutomationTrigger};
use super::runtime::AutomationHandle;

const LOCAL_POLL: Duration = Duration::from_secs(30);
const GH_POLL: Duration = Duration::from_secs(5 * 60);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);

/// Where a trigger stood at its last check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum Observation {
    Commit(String),
    Entries(HashSet<String>),
    /// GitHub Actions runs: every completed run id, and the failed ones.
    Runs { completed: HashSet<u64>, failed: Vec<FailedRun> },
    Issues(Vec<Issue>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct FailedRun {
    id: u64,
    name: String,
    branch: String,
    title: String,
    url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Issue {
    number: u64,
    title: String,
    url: String,
}

pub(super) fn validate(trigger: &AutomationTrigger) -> Result<(), String> {
    let (path, extra) = match trigger {
        AutomationTrigger::GitBranch { repo, branch } => (repo, Some(branch)),
        AutomationTrigger::NewFile { folder } => (folder, None),
        AutomationTrigger::CiFailed { repo } | AutomationTrigger::IssueAssigned { repo } => {
            (repo, None)
        }
    };
    if path.trim().is_empty() || !Path::new(path).is_dir() {
        return Err(format!("trigger folder `{path}` does not exist"));
    }
    if extra.is_some_and(|branch| branch.trim().is_empty()) {
        return Err("trigger branch is required".to_string());
    }
    Ok(())
}

fn uses_gh(trigger: &AutomationTrigger) -> bool {
    matches!(
        trigger,
        AutomationTrigger::CiFailed { .. } | AutomationTrigger::IssueAssigned { .. }
    )
}

async fn run(dir: &str, program: &str, args: &[&str]) -> Result<String, String> {
    let output = tokio::time::timeout(
        COMMAND_TIMEOUT,
        Command::new(program).args(args).current_dir(dir).output(),
    )
    .await
    .map_err(|_| format!("`{program}` did not answer within {}s", COMMAND_TIMEOUT.as_secs()))?
    .map_err(|e| format!("could not run `{program}`: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("`{program} {}` failed: {}", args.join(" "), stderr.trim()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub(super) async fn observe(trigger: &AutomationTrigger) -> Result<Observation, String> {
    match trigger {
        AutomationTrigger::GitBranch { repo, branch } => {
            let rev = format!("{}^{{commit}}", branch.trim());
            let sha = run(repo, "git", &["rev-parse", "--verify", "--quiet", &rev]).await?;
            Ok(Observation::Commit(sha.trim().to_string()))
        }
        AutomationTrigger::NewFile { folder } => {
            let mut entries = HashSet::new();
            let mut dir = tokio::fs::read_dir(folder)
                .await
                .map_err(|e| format!("cannot read `{folder}`: {e}"))?;
            while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
                let name = entry.file_name().to_string_lossy().into_owned();
                if !name.starts_with('.') {
                    entries.insert(name);
                }
            }
            Ok(Observation::Entries(entries))
        }
        AutomationTrigger::CiFailed { repo } => {
            let json = run(
                repo,
                "gh",
                &[
                    "run", "list", "--limit", "20", "--json",
                    "databaseId,status,conclusion,name,headBranch,displayTitle,url",
                ],
            )
            .await?;
            parse_runs(&json)
        }
        AutomationTrigger::IssueAssigned { repo } => {
            let json = run(
                repo,
                "gh",
                &[
                    "issue", "list", "--assignee", "@me", "--state", "open", "--limit", "100",
                    "--json", "number,title,url",
                ],
            )
            .await?;
            parse_issues(&json)
        }
    }
}

fn parse_runs(json: &str) -> Result<Observation, String> {
    let runs: Vec<Value> = serde_json::from_str(json).map_err(|e| format!("unexpected gh output: {e}"))?;
    let text = |run: &Value, key: &str| run[key].as_str().unwrap_or_default().to_string();
    let mut completed = HashSet::new();
    let mut failed = Vec::new();
    for run in &runs {
        let Some(id) = run["databaseId"].as_u64() else { continue };
        if run["status"] != "completed" {
            continue;
        }
        completed.insert(id);
        if run["conclusion"] == "failure" {
            failed.push(FailedRun {
                id,
                name: text(run, "name"),
                branch: text(run, "headBranch"),
                title: text(run, "displayTitle"),
                url: text(run, "url"),
            });
        }
    }
    Ok(Observation::Runs { completed, failed })
}

fn parse_issues(json: &str) -> Result<Observation, String> {
    let issues: Vec<Value> =
        serde_json::from_str(json).map_err(|e| format!("unexpected gh output: {e}"))?;
    Ok(Observation::Issues(
        issues
            .iter()
            .filter_map(|issue| {
                Some(Issue {
                    number: issue["number"].as_u64()?,
                    title: issue["title"].as_str().unwrap_or_default().to_string(),
                    url: issue["url"].as_str().unwrap_or_default().to_string(),
                })
            })
            .collect(),
    ))
}

/// What changed between two looks, as the line the run is given. `None`
/// when nothing worth a run happened.
pub(super) fn describe(trigger: &AutomationTrigger, old: &Observation, new: &Observation) -> Option<String> {
    match (trigger, old, new) {
        (AutomationTrigger::GitBranch { branch, .. }, Observation::Commit(a), Observation::Commit(b))
            if a != b =>
        {
            Some(format!("`{branch}` moved from {} to {}.", short(a), short(b)))
        }
        (AutomationTrigger::NewFile { folder }, Observation::Entries(a), Observation::Entries(b)) => {
            let mut added: Vec<&String> = b.difference(a).collect();
            if added.is_empty() {
                return None;
            }
            added.sort();
            let names: Vec<String> = added.iter().map(|n| format!("`{n}`")).collect();
            Some(format!("New in `{folder}`: {}.", names.join(", ")))
        }
        (
            AutomationTrigger::CiFailed { .. },
            Observation::Runs { completed: seen, .. },
            Observation::Runs { failed, .. },
        ) => {
            let fresh: Vec<String> = failed
                .iter()
                .filter(|run| !seen.contains(&run.id))
                .map(|run| format!("{} on `{}` failed: {} {}", run.name, run.branch, run.title, run.url))
                .collect();
            (!fresh.is_empty()).then(|| format!("CI failed.\n{}", fresh.join("\n")))
        }
        (AutomationTrigger::IssueAssigned { .. }, Observation::Issues(a), Observation::Issues(b)) => {
            let known: HashSet<u64> = a.iter().map(|i| i.number).collect();
            let fresh: Vec<String> = b
                .iter()
                .filter(|i| !known.contains(&i.number))
                .map(|i| format!("#{} {} {}", i.number, i.title, i.url))
                .collect();
            (!fresh.is_empty()).then(|| format!("Newly assigned to you:\n{}", fresh.join("\n")))
        }
        _ => None,
    }
}

fn short(sha: &str) -> &str {
    sha.get(..8).unwrap_or(sha)
}

/// The commits behind a branch move, for the run's context. Best effort.
async fn commit_log(trigger: &AutomationTrigger, old: &Observation, new: &Observation) -> Option<String> {
    let (AutomationTrigger::GitBranch { repo, .. }, Observation::Commit(a), Observation::Commit(b)) =
        (trigger, old, new)
    else {
        return None;
    };
    let range = format!("{a}..{b}");
    run(repo, "git", &["log", "--oneline", "--max-count=20", &range])
        .await
        .ok()
        .filter(|log| !log.trim().is_empty())
}

struct Watched {
    trigger: AutomationTrigger,
    last: Observation,
    checked: Instant,
}

/// Poll every triggered task for as long as the process runs.
pub(super) async fn watch(handle: AutomationHandle) {
    let mut watched: HashMap<String, Watched> = HashMap::new();
    loop {
        tokio::time::sleep(LOCAL_POLL).await;
        let (tasks, ctx) = {
            let runtime = handle.lock().await;
            let tasks: Vec<AutomationTask> = runtime
                .tasks
                .values()
                .filter(|task| task.trigger.is_some() && !task.paused)
                .cloned()
                .collect();
            (tasks, runtime.ctx.clone())
        };
        // A task that was removed, paused or given another trigger starts over.
        watched.retain(|id, w| tasks.iter().any(|t| &t.id == id && t.trigger.as_ref() == Some(&w.trigger)));

        let mut errors = HashMap::new();
        for task in tasks {
            let Some(trigger) = task.trigger.clone() else { continue };
            if let Some(w) = watched.get(&task.id)
                && uses_gh(&trigger)
                && w.checked.elapsed() < GH_POLL
            {
                continue;
            }
            let now = match observe(&trigger).await {
                Ok(now) => now,
                Err(error) => {
                    errors.insert(task.id.clone(), error);
                    continue;
                }
            };
            if let Some(w) = watched.get(&task.id)
                && let Some(mut event) = describe(&trigger, &w.last, &now)
            {
                if let Some(log) = commit_log(&trigger, &w.last, &now).await {
                    event.push_str(&format!("\n\n{}", log.trim_end()));
                }
                log::info!("automation '{}' triggered: {}", task.id, event.lines().next().unwrap_or_default());
                let ctx = ctx.clone();
                let task = task.clone();
                tokio::spawn(async move { execute_task_for_event(task, ctx, event).await });
            }
            watched.insert(task.id.clone(), Watched { trigger, last: now, checked: Instant::now() });
        }
        handle.lock().await.trigger_errors = errors;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn git(dir: &Path, args: &[&str]) {
        let status = std::process::Command::new("git")
            .args(args)
            .current_dir(dir)
            .env("GIT_AUTHOR_NAME", "t")
            .env("GIT_AUTHOR_EMAIL", "t@t")
            .env("GIT_COMMITTER_NAME", "t")
            .env("GIT_COMMITTER_EMAIL", "t@t")
            .status()
            .unwrap();
        assert!(status.success(), "git {args:?}");
    }

    #[tokio::test]
    async fn a_new_commit_on_the_watched_branch_fires_once_with_its_log() {
        let dir = std::env::temp_dir().join(format!("codexia-trigger-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        git(&dir, &["init", "-q", "-b", "main"]);
        git(&dir, &["commit", "-q", "--allow-empty", "-m", "first"]);
        let trigger = AutomationTrigger::GitBranch {
            repo: dir.to_string_lossy().into_owned(),
            branch: "main".into(),
        };
        validate(&trigger).unwrap();
        let before = observe(&trigger).await.unwrap();
        assert_eq!(describe(&trigger, &before, &observe(&trigger).await.unwrap()), None);

        git(&dir, &["commit", "-q", "--allow-empty", "-m", "fix the parser"]);
        let after = observe(&trigger).await.unwrap();
        let event = describe(&trigger, &before, &after).unwrap();
        assert!(event.starts_with("`main` moved from "), "{event}");
        assert!(commit_log(&trigger, &before, &after).await.unwrap().contains("fix the parser"));

        let missing = AutomationTrigger::GitBranch {
            repo: dir.to_string_lossy().into_owned(),
            branch: "nope".into(),
        };
        assert!(observe(&missing).await.is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test]
    async fn a_new_file_fires_and_hidden_or_existing_ones_do_not() {
        let dir = std::env::temp_dir().join(format!("codexia-trigger-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("old.pdf"), "").unwrap();
        let trigger = AutomationTrigger::NewFile { folder: dir.to_string_lossy().into_owned() };
        let before = observe(&trigger).await.unwrap();
        std::fs::write(dir.join(".DS_Store"), "").unwrap();
        assert_eq!(describe(&trigger, &before, &observe(&trigger).await.unwrap()), None);
        std::fs::write(dir.join("invoice.pdf"), "").unwrap();
        let event = describe(&trigger, &before, &observe(&trigger).await.unwrap()).unwrap();
        assert!(event.ends_with(": `invoice.pdf`."), "{event}");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn only_runs_that_failed_since_the_last_look_fire() {
        let trigger = AutomationTrigger::CiFailed { repo: "/".into() };
        let before = parse_runs(
            r#"[{"databaseId":3,"status":"in_progress","conclusion":"","name":"CI","headBranch":"main","displayTitle":"wip","url":"u3"},
                {"databaseId":2,"status":"completed","conclusion":"failure","name":"CI","headBranch":"main","displayTitle":"old","url":"u2"},
                {"databaseId":1,"status":"completed","conclusion":"success","name":"CI","headBranch":"main","displayTitle":"ok","url":"u1"}]"#,
        )
        .unwrap();
        assert_eq!(describe(&trigger, &before, &before), None);
        let after = parse_runs(
            r#"[{"databaseId":3,"status":"completed","conclusion":"failure","name":"CI","headBranch":"main","displayTitle":"wip","url":"u3"},
                {"databaseId":2,"status":"completed","conclusion":"failure","name":"CI","headBranch":"main","displayTitle":"old","url":"u2"}]"#,
        )
        .unwrap();
        assert_eq!(describe(&trigger, &before, &after).unwrap(), "CI failed.\nCI on `main` failed: wip u3");
        assert!(parse_runs("not json").is_err());
    }

    #[test]
    fn newly_assigned_issues_fire() {
        let trigger = AutomationTrigger::IssueAssigned { repo: "/".into() };
        let before = parse_issues(r#"[{"number":7,"title":"Old","url":"u7"}]"#).unwrap();
        let after = parse_issues(
            r#"[{"number":9,"title":"Crash on start","url":"u9"},{"number":7,"title":"Old","url":"u7"}]"#,
        )
        .unwrap();
        assert_eq!(
            describe(&trigger, &before, &after).unwrap(),
            "Newly assigned to you:\n#9 Crash on start u9"
        );
        assert_eq!(describe(&trigger, &after, &before), None);
    }

    #[test]
    fn triggers_need_an_existing_folder_and_a_branch() {
        let tmp = std::env::temp_dir().to_string_lossy().into_owned();
        assert!(validate(&AutomationTrigger::NewFile { folder: "/no/such/dir".into() }).is_err());
        assert!(validate(&AutomationTrigger::GitBranch { repo: tmp.clone(), branch: " ".into() }).is_err());
        assert!(validate(&AutomationTrigger::CiFailed { repo: tmp }).is_ok());
    }
}
