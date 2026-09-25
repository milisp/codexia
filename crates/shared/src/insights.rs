use agent_insights::domain::{AgentRecord, AgentType};
use agent_insights::services::{AggregationService, CollectionService};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentHeatmaps {
    pub claude: Option<agent_insights::domain::HeatmapData>,
    pub codex: Option<agent_insights::domain::HeatmapData>,
    pub gemini: Option<agent_insights::domain::HeatmapData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilterOptions {
    pub cwds: Vec<String>,
    pub session_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RankItem {
    pub key: String,
    pub sessions: u64,
    pub total_tokens: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub agents: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Rankings {
    pub by_cwd: Vec<RankItem>,
    pub by_session: Vec<RankItem>,
}

fn range_to_cutoff(range: &str) -> Option<chrono::NaiveDate> {
    let today = Utc::now().date_naive();
    match range {
        "day"   => Some(today - Duration::days(1)),
        "week"  => Some(today - Duration::days(7)),
        "month" => Some(today - Duration::days(30)),
        "year"  => Some(today - Duration::days(365)),
        _       => None,
    }
}

fn apply_filters(
    records: Vec<AgentRecord>,
    range: &Option<String>,
    cwd: &Option<String>,
    session_id: &Option<String>,
    agent: &Option<String>,
) -> Vec<AgentRecord> {
    let cutoff = range.as_deref().and_then(range_to_cutoff);
    records
        .into_iter()
        .filter(|r| cutoff.is_none_or(|c| r.created_at.date_naive() >= c))
        .filter(|r| cwd.as_ref().is_none_or(|f| r.cwd.as_deref() == Some(f)))
        .filter(|r| {
            session_id
                .as_ref()
                .is_none_or(|f| r.session_id.as_deref() == Some(f))
        })
        .filter(|r| {
            agent.as_ref().is_none_or(|f| match f.as_str() {
                "Claude" => matches!(r.agent_type, AgentType::Claude),
                "Codex"  => matches!(r.agent_type, AgentType::Codex),
                "Gemini" => matches!(r.agent_type, AgentType::Gemini),
                _        => true,
            })
        })
        .collect()
}

fn agent_name(t: &AgentType) -> &'static str {
    match t {
        AgentType::Claude  => "Claude",
        AgentType::Codex   => "Codex",
        AgentType::Gemini  => "Gemini",
        AgentType::Codexia => "Codexia",
    }
}

fn rank_by<F>(records: &[AgentRecord], key_fn: F, top: usize) -> Vec<RankItem>
where
    F: Fn(&AgentRecord) -> Option<String>,
{
    struct Acc {
        sessions:          u64,
        total_tokens:      u64,
        input_tokens:      u64,
        output_tokens:     u64,
        cache_read_tokens: u64,
        agents:            HashSet<String>,
    }

    let mut map: HashMap<String, Acc> = HashMap::new();

    for r in records {
        let Some(key) = key_fn(r) else { continue };
        let entry = map.entry(key).or_insert(Acc {
            sessions: 0, total_tokens: 0, input_tokens: 0,
            output_tokens: 0, cache_read_tokens: 0, agents: HashSet::new(),
        });
        entry.sessions += 1;
        entry.agents.insert(agent_name(&r.agent_type).to_string());
        if let Some(ref tok) = r.tokens {
            entry.total_tokens      += tok.total;
            entry.input_tokens      += tok.input;
            entry.output_tokens     += tok.output;
            entry.cache_read_tokens += tok.cached;
        }
    }

    let mut items: Vec<RankItem> = map
        .into_iter()
        .map(|(key, acc)| {
            let mut agents: Vec<String> = acc.agents.into_iter().collect();
            agents.sort();
            RankItem {
                key,
                sessions:          acc.sessions,
                total_tokens:      acc.total_tokens,
                input_tokens:      acc.input_tokens,
                output_tokens:     acc.output_tokens,
                cache_read_tokens: acc.cache_read_tokens,
                agents,
            }
        })
        .collect();

    items.sort_by_key(|item| std::cmp::Reverse(item.total_tokens));
    items.truncate(top);
    items
}

pub async fn get_agent_heatmaps(
    range: Option<String>,
    cwd: Option<String>,
    session_id: Option<String>,
    agent: Option<String>,
) -> Result<AgentHeatmaps, String> {
    let service = CollectionService::new().map_err(|e| e.to_string())?;
    let all_records = service.collect_all().await.map_err(|e| e.to_string())?;
    let records = apply_filters(all_records, &range, &cwd, &session_id, &agent);

    let mut by_agent = AggregationService::aggregate_by_agent(records);
    Ok(AgentHeatmaps {
        claude: by_agent.remove("Claude"),
        codex:  by_agent.remove("Codex"),
        gemini: by_agent.remove("Gemini"),
    })
}

pub async fn get_insight_rankings(
    range: Option<String>,
    cwd: Option<String>,
    session_id: Option<String>,
    agent: Option<String>,
) -> Result<Rankings, String> {
    let service = CollectionService::new().map_err(|e| e.to_string())?;
    let all_records = service.collect_all().await.map_err(|e| e.to_string())?;
    let records = apply_filters(all_records, &range, &cwd, &session_id, &agent);

    Ok(Rankings {
        by_cwd:     rank_by(&records, |r| r.cwd.clone(), 30),
        by_session: rank_by(&records, |r| r.session_id.clone(), 30),
    })
}

pub async fn get_insight_filter_options() -> Result<FilterOptions, String> {
    let service = CollectionService::new().map_err(|e| e.to_string())?;
    let records = service.collect_all().await.map_err(|e| e.to_string())?;

    let mut cwds: Vec<String> = records
        .iter()
        .filter_map(|r| r.cwd.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    cwds.sort();

    let mut session_ids: Vec<String> = records
        .iter()
        .filter_map(|r| r.session_id.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    session_ids.sort();

    Ok(FilterOptions { cwds, session_ids })
}
