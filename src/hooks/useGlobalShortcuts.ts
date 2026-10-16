import { useEffect } from 'react';
import { useCodexStore, useThreadReadStateStore } from '@/components/codex/stores';
import { toast } from '@/components/ui/use-toast';
import { isMacPlatform, resolveShortcut, type ShortcutId } from '@/hooks/keymap';
import { archiveThread } from '@/services/apiAdapt';
import { codexService } from '@/services/codexService';
import { setThreadReadState } from '@/services/threadReadState';
import { useLayoutStore } from '@/stores';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';

/** Fired after a shortcut changes the thread list so sidebar lists reload. */
export const THREADS_CHANGED_EVENT = 'codexia:threads-changed';

/** The Codex thread the user is looking at, if the Codex agent is the active one. */
function currentCodexThreadId(): string | null {
  if (useLayoutStore.getState().view !== 'agent') return null;
  if (useAcpStore.getState().active) return null;
  if (useAgentSettingsStore.getState().selectedAgent !== 'codex') return null;
  return useCodexStore.getState().currentThreadId;
}

async function archiveCurrentThread() {
  const threadId = currentCodexThreadId();
  if (!threadId) return;
  try {
    await archiveThread(threadId);
  } catch (err) {
    toast.error('Failed to archive thread', { description: String(err) });
    return;
  }
  if (useCodexStore.getState().currentThreadId === threadId) {
    await codexService.setCurrentThread(null);
  }
  window.dispatchEvent(new Event(THREADS_CHANGED_EVENT));
}

function toggleTerminal() {
  const layout = useLayoutStore.getState();
  // The right panel only exists next to the agent thread.
  if (layout.view !== 'agent') return;
  if (layout.isRightPanelOpen && layout.activeRightPanelTab === 'terminal') {
    layout.setRightPanelOpen(false);
    return;
  }
  layout.setActiveRightPanelTab('terminal');
  layout.setRightPanelOpen(true);
}

const ACTIONS: Partial<Record<ShortcutId, () => void>> = {
  settings: () => useLayoutStore.getState().setView('settings'),
  toggleTerminal,
  archiveChat: () => void archiveCurrentThread(),
  markUnread: () => {
    const threadId = currentCodexThreadId();
    if (!threadId) return;
    const state = useThreadReadStateStore.getState().states[threadId];
    // Toggle, like the sidebar menu item.
    void setThreadReadState(threadId, state?.firstUnread ? 'read' : 'unread');
  },
};

/** Single window-level key listener for every shortcut in the central keymap. */
export function useGlobalShortcuts() {
  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      const id = resolveShortcut(event, isMac);
      const action = id ? ACTIONS[id] : undefined;
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
