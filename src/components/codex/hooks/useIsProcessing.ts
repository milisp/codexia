import { useCodexStore } from '@/components/codex/stores';
import type { ThreadStatus } from '@/bindings/v2/ThreadStatus';

/** Full ThreadStatus for a given thread (or currentThreadId). */
export function useThreadStatus(threadId?: string | null): ThreadStatus | undefined {
  const { currentThreadId, threadStatusMap } = useCodexStore();
  const id = threadId !== undefined ? threadId : currentThreadId;
  return id ? threadStatusMap[id] : undefined;
}

/** True when the thread is active (thinking, waiting for approval, or waiting for input). */
export function useIsProcessing(threadId?: string | null): boolean {
  return useThreadStatus(threadId)?.type === 'active';
}
