import type {
  ExternalAgentConfigImportItemTypeFailure,
  ExternalAgentConfigImportItemTypeSuccess,
  ExternalAgentConfigImportTypeResult,
  ExternalAgentConfigMigrationItem,
  ExternalAgentConfigMigrationItemType,
} from '@/bindings/v2';

/** Provider identifier reported to the app-server for analytics / history. */
export const IMPORT_PROVIDER_ID = 'claude-code';

/** Source identifier reported to the app-server for analytics. */
export const IMPORT_SOURCE = 'codexia';

const ITEM_TYPE_LABELS: Record<ExternalAgentConfigMigrationItemType, string> = {
  AGENTS_MD: 'AGENTS.md',
  CONFIG: 'Configuration',
  SKILLS: 'Skills',
  PLUGINS: 'Plugins',
  MCP_SERVER_CONFIG: 'MCP servers',
  SUBAGENTS: 'Subagents',
  HOOKS: 'Hooks',
  COMMANDS: 'Commands',
  MEMORY: 'Memory',
  SESSIONS: 'Recent chats',
};

export function itemTypeLabel(itemType: ExternalAgentConfigMigrationItemType): string {
  return ITEM_TYPE_LABELS[itemType] ?? itemType;
}

/** Stable identity for a migration item: the pair of type and scope. */
export function migrationItemKey(item: ExternalAgentConfigMigrationItem): string {
  return `${item.itemType}::${item.cwd ?? ''}`;
}

export interface MigrationItemGroup {
  itemType: ExternalAgentConfigMigrationItemType;
  items: ExternalAgentConfigMigrationItem[];
}

/** Groups detected items by their type, preserving detection order. */
export function groupByItemType(items: ExternalAgentConfigMigrationItem[]): MigrationItemGroup[] {
  const groups = new Map<
    ExternalAgentConfigMigrationItemType,
    ExternalAgentConfigMigrationItem[]
  >();
  for (const item of items) {
    const bucket = groups.get(item.itemType);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(item.itemType, [item]);
    }
  }
  return [...groups.entries()].map(([itemType, grouped]) => ({ itemType, items: grouped }));
}

export function countResults(results: ExternalAgentConfigImportTypeResult[]): {
  successes: number;
  failures: number;
} {
  let successes = 0;
  let failures = 0;
  for (const result of results) {
    successes += result.successes.length;
    failures += result.failures.length;
  }
  return { successes, failures };
}

export function flattenSuccesses(
  results: ExternalAgentConfigImportTypeResult[]
): ExternalAgentConfigImportItemTypeSuccess[] {
  return results.flatMap((result) => result.successes);
}

export function flattenFailures(
  results: ExternalAgentConfigImportTypeResult[]
): ExternalAgentConfigImportItemTypeFailure[] {
  return results.flatMap((result) => result.failures);
}

/** `completedAtMs` arrives as a bigint in the bindings but as a number over JSON. */
export function formatCompletedAt(completedAtMs: bigint | number): string {
  const millis = typeof completedAtMs === 'bigint' ? Number(completedAtMs) : completedAtMs;
  if (!Number.isFinite(millis) || millis <= 0) {
    return 'Unknown date';
  }
  return new Date(millis).toLocaleString();
}

/** Short scope label: the last path segment, or "Home" for home-scoped items. */
export function scopeLabel(cwd: string | null): string {
  if (!cwd) {
    return 'Home';
  }
  const segments = cwd.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? cwd;
}
