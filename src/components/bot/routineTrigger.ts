import type { AutomationTrigger } from '@/services/apiAdapt/automation';

export type TriggerKind = AutomationTrigger['kind'];

export const TRIGGER_KINDS: { kind: TriggerKind; label: string; pathLabel: string }[] = [
  { kind: 'git_branch', label: 'New commits on a branch', pathLabel: 'Repository' },
  { kind: 'new_file', label: 'A new file in a folder', pathLabel: 'Folder' },
  { kind: 'ci_failed', label: 'A GitHub Actions run fails', pathLabel: 'Repository' },
  { kind: 'issue_assigned', label: 'A GitHub issue is assigned to you', pathLabel: 'Repository' },
];

/** A trigger of `kind` watching `path`, keeping the branch when there is one. */
export function makeTrigger(kind: TriggerKind, path: string, branch = 'main'): AutomationTrigger {
  switch (kind) {
    case 'git_branch':
      return { kind, repo: path, branch };
    case 'new_file':
      return { kind, folder: path };
    default:
      return { kind, repo: path };
  }
}

export function triggerPath(trigger: AutomationTrigger) {
  return trigger.kind === 'new_file' ? trigger.folder : trigger.repo;
}

/** "When main gets new commits", for the routines list. */
export function describeTrigger(trigger: AutomationTrigger) {
  const name = triggerPath(trigger).split('/').filter(Boolean).pop() ?? triggerPath(trigger);
  switch (trigger.kind) {
    case 'git_branch':
      return `When ${trigger.branch} gets new commits · ${name}`;
    case 'new_file':
      return `When a file appears in ${name}`;
    case 'ci_failed':
      return `When CI fails · ${name}`;
    case 'issue_assigned':
      return `When an issue is assigned to you · ${name}`;
  }
}
