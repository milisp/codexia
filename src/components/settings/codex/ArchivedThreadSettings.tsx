import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ThreadListParams, ThreadListResponse } from '@/bindings/v2';
import { threadList, threadUnarchive } from '@/services/tauri';
import { ThreadId } from '@/bindings';
import { getFilename } from '@/utils/getFilename';
import { formatThreadAge } from '@/utils/formatThreadAge';

const EMPTY_LIST: ThreadListResponse = { data: [], nextCursor: null, backwardsCursor: null };

export function ArchivedThreadSettings() {
  const [response, setResponse] = useState<ThreadListResponse>(EMPTY_LIST);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threads = response.data;

  const loadArchivedThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: ThreadListParams = {
        cursor: null,
        limit: 50,
        modelProviders: null,
        archived: true,
      };
      const resp = await threadList(params);
      setResponse(resp);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unarchiveThread = useCallback(async (threadId: ThreadId) => {
    setIsLoading(true);
    setError(null);
    try {
      await threadUnarchive(threadId);
      await loadArchivedThreads();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchivedThreads();
  }, [loadArchivedThreads]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">Archived Threads</h3>
        <Button size="sm" variant="ghost" onClick={loadArchivedThreads} disabled={isLoading}>
          Refresh
        </Button>
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          {error ? (
            <div className="text-xs text-destructive">Failed to load archived threads: {error}</div>
          ) : null}
          {!error && !isLoading && threads.length === 0 ? (
            <div className="text-xs text-muted-foreground">No archived threads found.</div>
          ) : null}
          {threads.map((thread) => (
            <div
              key={thread.id}
              className="flex items-center justify-between rounded-md border p-2"
            >
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium truncate">
                  {thread.preview || 'Untitled thread'}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{formatThreadAge(thread.createdAt ?? 0)}</span>
                  <span>{getFilename(thread.cwd)}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => unarchiveThread(thread.id)}
                disabled={isLoading}
              >
                Unarchive
              </Button>
            </div>
          ))}
          {isLoading ? <div className="text-xs text-muted-foreground">Loading...</div> : null}
        </CardContent>
      </Card>
    </section>
  );
}
