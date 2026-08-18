import { AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  ExternalAgentConfigImportHistory,
  ExternalAgentConfigImportTypeResult,
  ExternalAgentConfigMigrationItem,
} from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { isTauri } from '@/hooks/runtime';
import {
  externalAgentConfigDetect,
  externalAgentConfigImport,
  externalAgentConfigImportReadHistories,
  externalAgentConfigImportRecordHistory,
} from '@/services';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ImportHistorySection } from './ImportHistorySection';
import {
  countResults,
  flattenFailures,
  groupByItemType,
  IMPORT_PROVIDER_ID,
  IMPORT_SOURCE,
  itemTypeLabel,
  migrationItemKey,
  scopeLabel,
} from './importDialogUtils';
import { useImportNotifications } from './useImportNotifications';

type Phase = 'loading' | 'select' | 'importing' | 'done';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * `/import`: detects Claude Code setup, project files and recent chats, lets
 * the user pick what to bring over, and runs the app-server import while
 * streaming its progress.
 */
export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const cwd = useWorkspaceStore((s) => s.cwd);

  const [phase, setPhase] = useState<Phase>('loading');
  const [detectError, setDetectError] = useState<string | null>(null);
  const [items, setItems] = useState<ExternalAgentConfigMigrationItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<ExternalAgentConfigImportTypeResult[]>([]);
  const [histories, setHistories] = useState<ExternalAgentConfigImportHistory[]>([]);

  const importIdRef = useRef<string | null>(null);

  const loadHistories = useCallback(async () => {
    try {
      const response = await externalAgentConfigImportReadHistories();
      setHistories(response.data ?? []);
    } catch (error) {
      // History is informational only.
      console.warn('[ImportDialog] failed to read import histories:', error);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setPhase('loading');
    setDetectError(null);
    setResults([]);
    importIdRef.current = null;

    externalAgentConfigDetect({ includeHome: true, cwds: cwd ? [cwd] : [] })
      .then((response) => {
        if (cancelled) return;
        const detected = response.items ?? [];
        setItems(detected);
        setSelected(new Set(detected.map(migrationItemKey)));
        setPhase('select');
      })
      .catch((error) => {
        if (cancelled) return;
        setItems([]);
        setSelected(new Set());
        setDetectError(error instanceof Error ? error.message : String(error));
        setPhase('select');
      });

    loadHistories();

    return () => {
      cancelled = true;
    };
  }, [open, cwd, loadHistories]);

  const finishImport = useCallback(
    async (finalResults: ExternalAgentConfigImportTypeResult[]) => {
      setResults(finalResults);
      setPhase('done');
      const { successes, failures } = countResults(finalResults);
      if (failures > 0) {
        toast.error(`Imported ${successes} item(s), ${failures} failed`);
      } else {
        toast.success(`Imported ${successes} item(s) from Claude Code`);
      }
      if (successes > 0) {
        try {
          await externalAgentConfigImportRecordHistory({
            providerId: IMPORT_PROVIDER_ID,
            itemTypeResults: finalResults,
          });
        } catch (error) {
          console.warn('[ImportDialog] failed to record import history:', error);
        }
        loadHistories();
      }
    },
    [loadHistories]
  );

  useImportNotifications(phase === 'importing', {
    onProgress: (importId, itemTypeResults) => {
      if (importIdRef.current && importId !== importIdRef.current) return;
      setResults(itemTypeResults);
    },
    onCompleted: (importId, itemTypeResults) => {
      if (importIdRef.current && importId !== importIdRef.current) return;
      finishImport(itemTypeResults);
    },
  });

  const groups = useMemo(() => groupByItemType(items), [items]);
  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(migrationItemKey(item))),
    [items, selected]
  );

  const toggleItem = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const runImport = async () => {
    setResults([]);
    setPhase('importing');
    try {
      const response = await externalAgentConfigImport({
        migrationItems: selectedItems,
        source: IMPORT_SOURCE,
        providerId: IMPORT_PROVIDER_ID,
      });
      importIdRef.current = response.importId;
      if (!isTauri()) {
        // Notifications only reach the Tauri event bridge; outside it the
        // import still runs but no progress can be observed.
        toast.success('Import started');
        onClose();
      }
    } catch (error) {
      setPhase('select');
      toast.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const { successes, failures } = countResults(results);
  const progressValue =
    selectedItems.length === 0
      ? 0
      : Math.min(100, Math.round((results.length / selectedItems.length) * 100));

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Claude Code</DialogTitle>
          <DialogDescription>
            Bring your setup, this project's files and recent chats into Codex.
          </DialogDescription>
        </DialogHeader>

        {phase === 'loading' && (
          <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Detecting Claude Code configuration...
          </div>
        )}

        {phase === 'select' && (
          <div className="space-y-2">
            {detectError && (
              <div className="flex items-start gap-2 text-destructive text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{detectError}</span>
              </div>
            )}
            {!detectError && items.length === 0 && (
              <p className="py-8 text-center text-muted-foreground text-sm">
                Nothing to import was found.
              </p>
            )}
            {items.length > 0 && (
              <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <div key={group.itemType} className="space-y-1">
                    <div className="font-medium text-sm">{itemTypeLabel(group.itemType)}</div>
                    {group.items.map((item) => {
                      const key = migrationItemKey(item);
                      return (
                        <label
                          key={key}
                          htmlFor={`import-item-${key}`}
                          className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-accent/50"
                        >
                          <Checkbox
                            id={`import-item-${key}`}
                            checked={selected.has(key)}
                            onCheckedChange={() => toggleItem(key)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm">{item.description}</span>
                            <span className="block truncate text-muted-foreground text-xs">
                              {scopeLabel(item.cwd)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            <ImportHistorySection histories={histories} />
          </div>
        )}

        {phase === 'importing' && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Importing {selectedItems.length} item(s)...
            </div>
            <Progress value={progressValue} />
            <p className="text-muted-foreground text-xs">
              {successes} imported{failures > 0 ? `, ${failures} failed` : ''}
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="max-h-80 space-y-3 overflow-y-auto py-2">
            <div className="flex items-center gap-2 text-sm">
              {failures > 0 ? (
                <AlertCircle className="size-4 text-destructive" />
              ) : (
                <CheckCircle2 className="size-4 text-emerald-500" />
              )}
              {successes} imported{failures > 0 ? `, ${failures} failed` : ''}
            </div>
            {results.map((result) => (
              <div key={result.itemType} className="space-y-1">
                <div className="font-medium text-sm">{itemTypeLabel(result.itemType)}</div>
                {result.successes.map((success) => (
                  <div
                    key={`${success.itemType}-${success.source}-${success.target}`}
                    className="truncate text-muted-foreground text-xs"
                  >
                    {success.target ?? success.source ?? scopeLabel(success.cwd)}
                  </div>
                ))}
              </div>
            ))}
            {flattenFailures(results).map((failure) => (
              <div
                key={`${failure.itemType}-${failure.source}-${failure.message}`}
                className="text-destructive text-xs"
              >
                {itemTypeLabel(failure.itemType)}: {failure.message}
                {failure.failureStage ? ` (${failure.failureStage})` : ''}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {phase === 'done' ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={phase === 'importing'}>
                Cancel
              </Button>
              <Button
                onClick={runImport}
                disabled={phase !== 'select' || selectedItems.length === 0}
              >
                <Download className="size-4" />
                Import{selectedItems.length > 0 ? ` (${selectedItems.length})` : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
