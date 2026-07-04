import type { ThreadGoal } from '@/bindings/v2';
import { useCodexStore } from '@/components/codex/stores';

/** Full ThreadGoal for a given thread (or currentThreadId), if one is set. */
export function useThreadGoal(threadId?: string | null): ThreadGoal | undefined {
  const { currentThreadId, goalMap } = useCodexStore();
  const id = threadId !== undefined ? threadId : currentThreadId;
  return id ? goalMap[id] : undefined;
}
