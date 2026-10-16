import type { ThreadReadStateOperation } from '@/bindings/v2';
import { useCodexStore } from '@/components/codex/stores/useCodexStore';
import { useThreadReadStateStore } from '@/components/codex/stores/useThreadReadStateStore';
import { toast } from '@/components/ui/use-toast';
import { updateThreadReadState } from '@/services/apiAdapt';

// Threads with an update in flight; a second request would race on the revision.
const inFlight = new Set<string>();

/**
 * The open thread the user explicitly marked unread. Opening a thread marks it
 * read, so this one is exempt until the user switches to another thread.
 */
export const keptUnreadThreads = new Set<string>();

/**
 * Mark a thread read or unread on the server (`thread/readState/update`).
 *
 * The request is guarded by the revision we last saw. The local state is
 * updated optimistically, replaced by the server's answer on success, and
 * restored (with a toast) if the server rejects the update, for example on a
 * revision conflict. Returns whether the server accepted it.
 */
export async function setThreadReadState(
  threadId: string,
  operation: ThreadReadStateOperation['type']
): Promise<boolean> {
  const store = useThreadReadStateStore.getState();
  const previous = store.states[threadId];
  if (!previous) {
    toast.error('Could not update read state', {
      description: 'The read state of this chat has not been loaded yet.',
    });
    return false;
  }
  if (inFlight.has(threadId)) return false;
  // Already in the requested state: nothing to ask the server.
  if ((previous.firstUnread === null) === (operation === 'read')) return true;

  inFlight.add(threadId);
  if (operation === 'unread' && useCodexStore.getState().currentThreadId === threadId)
    keptUnreadThreads.add(threadId);
  store.setState(threadId, {
    ...previous,
    firstUnread: operation === 'read' ? null : { type: 'threadStart' },
  });
  try {
    const response = await updateThreadReadState({
      threadId,
      operation: { type: operation },
      expectedRevision: previous.revision,
    });
    // Record the exemption before publishing the new state so the open-thread
    // effect never sees an unread thread it is allowed to mark read.
    if (operation === 'unread' && useCodexStore.getState().currentThreadId === threadId) {
      keptUnreadThreads.add(threadId);
    } else {
      keptUnreadThreads.delete(threadId);
    }
    useThreadReadStateStore.getState().setState(threadId, response.readState);
    return true;
  } catch (err) {
    keptUnreadThreads.delete(threadId);
    useThreadReadStateStore.getState().setState(threadId, previous);
    toast.error(
      operation === 'read' ? 'Failed to mark chat as read' : 'Failed to mark chat as unread',
      { description: String(err) }
    );
    return false;
  } finally {
    inFlight.delete(threadId);
  }
}
