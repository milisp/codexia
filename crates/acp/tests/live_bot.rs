//! Live unattended bot runs against the installed keke and a real model.
//! Requires keke >= 0.1.44 on PATH and a signed-in provider, so it is ignored
//! by default:
//!
//! `LIVE_BOT_PROVIDER=grok LIVE_BOT_MODEL=grok-4.7 \
//!   cargo test -p codexia-acp --test live_bot -- --ignored --nocapture`
//!
//! Codexia's own state (database, keke MCP file) goes to a temporary HOME;
//! keke keeps its real home through KEKE_HOME so its credentials still work.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use codexia_acp::AcpState;
use codexia_db::bots::{BotPatch, create_bot, update_bot};
use codexia_shared::event_sink::EventSink;
use serde_json::{Value, json};

#[derive(Default)]
struct RecordingSink(Mutex<Vec<(String, Value)>>);

impl EventSink for RecordingSink {
    fn emit(&self, event: &str, payload: Value) {
        if event == codexia_acp::BOT_EVENT {
            println!("[{event}] {payload}");
        }
        self.0.lock().unwrap().push((event.to_string(), payload));
    }
}

impl RecordingSink {
    fn bot_statuses(&self, bot_id: &str) -> Vec<String> {
        self.0
            .lock()
            .unwrap()
            .iter()
            .filter(|(e, p)| e == codexia_acp::BOT_EVENT && p["botId"] == bot_id)
            .filter_map(|(_, p)| p["status"].as_str().map(str::to_string))
            .collect()
    }
}

const PROMPT: &str = "Use the shop tools. First call lookup_price for the item `tea`. \
Then call create_payment with amount 5 and to `alice`. Do not ask me anything; \
just make the calls, then reply with one short sentence saying what happened.";

/// Point this process (and the keke it spawns) at a scratch HOME.
fn scratch_home() -> PathBuf {
    let real_home = dirs::home_dir().expect("home");
    let home = std::env::temp_dir().join(format!("codexia-live-bot-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(home.join(".keke")).unwrap();
    // SAFETY: set before any other thread reads the environment.
    unsafe {
        std::env::set_var("KEKE_HOME", real_home.join(".keke"));
        std::env::set_var("HOME", &home);
    }
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/shop_mcp.py");
    let mcp = json!({ "mcpServers": { "shop": {
        "command": "python3",
        "args": [script],
        "env": { "SHOP_LOG": home.join("shop.log") },
    }}});
    std::fs::write(home.join(".keke/.mcp.json"), mcp.to_string()).unwrap();
    home
}

fn shop_calls(home: &Path) -> Vec<String> {
    std::fs::read_to_string(home.join("shop.log"))
        .unwrap_or_default()
        .lines()
        .map(str::to_string)
        .collect()
}

fn new_bot(home: &Path, name: &str) -> String {
    let id = uuid::Uuid::new_v4().to_string();
    let cwd = home.join(name);
    std::fs::create_dir_all(&cwd).unwrap();
    create_bot(&id, name, "🤖", "blue", "keke", &cwd.to_string_lossy(), "autonomous").unwrap();
    let env = |key: &str| std::env::var(key).ok().filter(|v| !v.is_empty());
    update_bot(
        &id,
        &BotPatch {
            provider: env("LIVE_BOT_PROVIDER"),
            model: env("LIVE_BOT_MODEL"),
            mcp_servers: Some(vec!["keke:shop".into()]),
            ..Default::default()
        },
    )
    .unwrap();
    id
}

/// Run the bot, answer its payment request with `answer`, and return the report.
async fn run_and_answer(
    state: &Arc<AcpState>,
    bot_id: &str,
    answer: &str,
) -> codexia_acp::RunReport {
    let run = tokio::spawn({
        let state = Arc::clone(state);
        let bot_id = bot_id.to_string();
        async move { state.run_bot_unattended(&bot_id, PROMPT, None, false, |_| {}).await }
    });

    let mut run = run;
    let waiting = tokio::time::timeout(Duration::from_secs(300), async {
        loop {
            if let Some(w) = state.waiting_approvals(Some(bot_id)).into_iter().next() {
                return w;
            }
            if run.is_finished() {
                let ended = (&mut run).await.unwrap().map(|r| r.reply);
                panic!("run ended without asking for the payment: {ended:?}");
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    })
    .await
    .expect("no waiting approval within 5 minutes");
    println!("waiting: {waiting:#}");

    assert_eq!(waiting["personRequired"], true, "payment must need a person");
    let options = waiting["options"].as_array().expect("options");
    assert!(
        options.iter().all(|o| o["kind"] != "allow_always"),
        "a person-required request must not offer allow-always: {options:?}"
    );
    let option = options
        .iter()
        .find(|o| o["kind"] == answer)
        .unwrap_or_else(|| panic!("no `{answer}` option in {options:?}"));

    state
        .respond_permission(
            waiting["connectionId"].as_str().unwrap(),
            waiting["requestId"].as_str().unwrap(),
            option["optionId"].as_str().map(str::to_string),
        )
        .unwrap();

    let report = tokio::time::timeout(Duration::from_secs(300), run)
        .await
        .expect("run did not finish within 5 minutes")
        .unwrap()
        .expect("run failed");
    println!("reply ({answer}): {}", report.reply);
    report
}

#[tokio::test(flavor = "multi_thread")]
#[ignore]
async fn payment_waits_for_a_person() {
    let home = scratch_home();
    let sink = Arc::new(RecordingSink::default());
    let state = Arc::new(AcpState::new(sink.clone()));

    // Allowed: the payment runs once and the run is not blocked.
    let allowed = new_bot(&home, "allow-bot");
    let report = run_and_answer(&state, &allowed, "allow_once").await;
    let calls = shop_calls(&home);
    println!("shop calls after allow: {calls:?}");
    assert!(!report.blocked, "an allowed payment must not block the run");
    assert_eq!(calls.iter().filter(|c| c.contains("create_payment")).count(), 1);
    let statuses = sink.bot_statuses(&allowed);
    assert!(statuses.contains(&"waiting".to_string()), "{statuses:?}");
    assert_eq!(statuses.last().map(String::as_str), Some("done"), "{statuses:?}");

    // Denied: the payment never runs and the run is reported as blocked.
    std::fs::remove_file(home.join("shop.log")).ok();
    let denied = new_bot(&home, "deny-bot");
    let report = run_and_answer(&state, &denied, "reject_once").await;
    let calls = shop_calls(&home);
    println!("shop calls after deny: {calls:?}");
    assert!(report.blocked, "a denied payment must block the run");
    assert!(calls.iter().all(|c| !c.contains("create_payment")), "{calls:?}");
    assert_eq!(sink.bot_statuses(&denied).last().map(String::as_str), Some("blocked"));

    std::fs::remove_dir_all(&home).ok();
}
