mod execution;
mod model;
mod recorder;
mod runtime;
mod schedule;
mod service;
mod worktree;

pub use codexia_db::automation_runs::AutomationRunRecord;
pub use model::{AutomationSchedule, AutomationTask, CwdMode};
pub use runtime::AutomationHandle;
pub use service::{
    AutomationInput, create_automation, delete_automation, list_automation_runs, list_automations,
    run_automation_now, set_automation_paused, update_automation,
};
