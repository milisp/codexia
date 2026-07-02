import type { ServerNotification } from '@/bindings';
import type { FileUpdateChange } from '@/bindings/v2';
import { getDiffCounts, normalizeUnifiedDiff, splitUnifiedDiffByFile } from '@/utils/diff';

export type AggregatedFileChange = {
  path: string;
  diff: string;
  kind: FileUpdateChange['kind'];
  addedCount: number;
  removedCount: number;
};

export type RenderEventContext = {
  events?: ServerNotification[];
  eventIndex?: number;
};

export type DiffViewerInput = {
  original?: string;
  current?: string;
  unifiedDiff?: string;
  displayPath?: string;
};

const defaultUpdateKind: FileUpdateChange['kind'] = { type: 'update', move_path: null };

const normalizePathForMatch = (path: string) => path.replace(/\\/g, '/');

const isLikelyUnifiedDiff = (value?: string) => {
  if (!value) return false;
  const text = normalizeUnifiedDiff(value);
  return (
    text.startsWith('diff --git ') ||
    text.includes('\n@@ ') ||
    text.includes('\n--- ') ||
    text.includes('\n+++ ')
  );
};

const shouldSkipUnifiedLine = (line: string) =>
  line === '\\ No newline at end of file' ||
  line.startsWith('diff --git') ||
  line.startsWith('index ') ||
  line.startsWith('@@') ||
  line.startsWith('+++ ') ||
  line.startsWith('--- ') ||
  /^\s*(new file|deleted file)\b/i.test(line) ||
  /^\s*mode \d+/i.test(line) ||
  /^\s*(new mode|old mode)\b/i.test(line) ||
  /^\s*similarity index\b/i.test(line) ||
  /^\s*rename (from|to)\b/i.test(line);

const extractContentFromUnified = (kind: FileUpdateChange['kind']['type'], value: string) => {
  const text = normalizeUnifiedDiff(value);
  const out: string[] = [];

  for (const line of text.split('\n')) {
    if (shouldSkipUnifiedLine(line)) continue;
    if (kind === 'add' && line.startsWith('+')) {
      out.push(line.slice(1));
      continue;
    }
    if (kind === 'delete' && line.startsWith('-')) {
      out.push(line.slice(1));
    }
  }

  return out.join('\n');
};

const normalizeChangeDiff = (kind: FileUpdateChange['kind'], diff: string) => {
  if ((kind.type === 'add' || kind.type === 'delete') && isLikelyUnifiedDiff(diff)) {
    return extractContentFromUnified(kind.type, diff);
  }
  return diff;
};

const countContentLines = (content?: string) => {
  if (!content) return 0;
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.length;
};

const resolveChangeKind = (
  path: string,
  kindEntries: Array<{ path: string; kind: FileUpdateChange['kind'] }>
): FileUpdateChange['kind'] => {
  const normalizedPath = normalizePathForMatch(path);
  const exact = kindEntries.find((entry) => normalizePathForMatch(entry.path) === normalizedPath);
  if (exact) return exact.kind;

  const suffix = kindEntries.find((entry) =>
    normalizePathForMatch(entry.path).endsWith(`/${normalizedPath}`)
  );
  return suffix?.kind ?? defaultUpdateKind;
};

export const getChangeCounts = (kind: FileUpdateChange['kind'], diff: string) => {
  if (kind.type === 'add') {
    return { addedCount: countContentLines(diff), removedCount: 0 };
  }

  if (kind.type === 'delete') {
    return { addedCount: 0, removedCount: countContentLines(diff) };
  }

  return getDiffCounts({
    unifiedDiff: diff,
    diffLines: [],
  });
};

export const getDiffViewerProps = (change: {
  path: string;
  kind: FileUpdateChange['kind'];
  diff: string;
}): DiffViewerInput => {
  if (change.kind.type === 'add') {
    return { original: '', current: change.diff, unifiedDiff: undefined, displayPath: change.path };
  }
  if (change.kind.type === 'delete') {
    return { original: change.diff, current: '', unifiedDiff: undefined, displayPath: change.path };
  }
  return { unifiedDiff: change.diff, displayPath: change.path };
};

export const aggregateFileChanges = (changes: FileUpdateChange[]): AggregatedFileChange[] => {
  const merged = new Map<string, Omit<AggregatedFileChange, 'addedCount' | 'removedCount'>>();

  changes.forEach((change, changeIndex) => {
    const splitDiffs = splitUnifiedDiffByFile(change.diff);
    const entries =
      splitDiffs.length > 0 ? splitDiffs : [{ path: change.path, diff: change.diff ?? '' }];

    entries.forEach((entry, entryIndex) => {
      const fallbackPath = `unknown-${changeIndex + 1}-${entryIndex + 1}`;
      const path = entry.path || change.path || fallbackPath;
      const key = path;
      const existing = merged.get(key);
      const normalizedDiff = normalizeChangeDiff(change.kind, entry.diff ?? '');
      const nextDiff = normalizedDiff.trim() ? normalizedDiff : (existing?.diff ?? '');

      if (existing) {
        existing.kind = change.kind;
        if (nextDiff) {
          existing.diff = nextDiff;
        }
        return;
      }

      merged.set(key, {
        path,
        diff: nextDiff,
        kind: change.kind,
      });
    });
  });

  return Array.from(merged.values()).map((change) => {
    const { addedCount, removedCount } = getChangeCounts(change.kind, change.diff);
    return {
      ...change,
      addedCount,
      removedCount,
    };
  });
};

export const aggregateTurnChangesFromContext = (
  turnId: string,
  context?: RenderEventContext
): AggregatedFileChange[] => {
  const events = context?.events;
  const eventIndex = context?.eventIndex ?? -1;

  if (!events || eventIndex < 0) return [];

  const itemChanges: FileUpdateChange[] = [];
  const kindEntries: Array<{ path: string; kind: FileUpdateChange['kind'] }> = [];
  let latestTurnDiff = '';

  for (let i = 0; i <= eventIndex; i += 1) {
    const event = events[i];

    if (event.method === 'turn/diff/updated' && event.params.turnId === turnId) {
      latestTurnDiff = event.params.diff;
      continue;
    }

    if (
      event.method === 'item/completed' &&
      event.params.turnId === turnId &&
      event.params.item.type === 'fileChange'
    ) {
      for (const change of event.params.item.changes) {
        itemChanges.push(change);
        kindEntries.push({ path: change.path, kind: change.kind });
      }
    }
  }

  const splitDiffs = splitUnifiedDiffByFile(latestTurnDiff);
  if (splitDiffs.length > 0) {
    return splitDiffs.map((fileDiff, index) => {
      const path = fileDiff.path || `unknown-${index + 1}`;
      const kind = resolveChangeKind(path, kindEntries);
      const normalizedDiff = normalizeChangeDiff(kind, fileDiff.diff);
      const { addedCount, removedCount } = getChangeCounts(kind, normalizedDiff);
      return {
        path,
        diff: normalizedDiff,
        kind,
        addedCount,
        removedCount,
      };
    });
  }

  return aggregateFileChanges(itemChanges);
};
