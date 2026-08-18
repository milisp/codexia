import { Settings, SquarePen } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AgentSwitcher } from '@/components/agent';
import { useThreadList } from '@/components/codex/hooks';
import { SideBarAcpTab, SideBarClaudeTab, SideBarCodexTab } from '@/components/layout/SideBarTab';
import { DesktopDrawer } from '@/components/pairing/DesktopDrawer';
import { Button } from '@/components/ui/button';
import { loadRemoteSettings, remoteSettingsError } from '@/lib/settings';
import { useAcpStore } from '@/stores/useAcpStore';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useSelectedDesktop } from '@/stores/usePairingStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

/**
 * The phone's home screen: which desktop is being driven, and its threads.
 *
 * A phone drives sessions rather than administering a workspace, so the
 * desktop's plugins/automations/insights nav and its right panel are absent —
 * everything here is either "which machine" or "which conversation".
 */
export function MobileHome({
  onNewInProject,
  onNewSession,
}: {
  /** Start a session in a specific project, from a list group's "+" action. */
  onNewInProject: (directory: string) => void;
  /** Start a session in the current workspace, from the floating button. */
  onNewSession: () => void;
}) {
  const desktop = useSelectedDesktop();
  const selectedAgent = useAgentSettingsStore((s) => s.selectedAgent);
  const acpActive = useAcpStore((s) => s.active);
  const [desktopsOpen, setDesktopsOpen] = useState(false);

  // Codex threads live in a store that nothing else fills — the desktop loads
  // them from its sidebar, so this screen has to do it here.
  useThreadList({ enabled: selectedAgent === 'codex' });

  // The projects come from the paired desktop; when that read comes back empty
  // say so rather than showing a bare list, since the phone cannot add any.
  const projects = useWorkspaceStore((s) => s.projects);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(remoteSettingsError());

  const reload = useCallback(async () => {
    setLoading(true);
    await loadRemoteSettings();
    setError(remoteSettingsError());
    setLoading(false);
  }, []);

  return (
    <div className="relative flex h-full min-h-0 flex-col select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
      {/* Row 1: the machine this phone is pointed at. */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <span className="min-w-0 flex-1 truncate font-medium text-base">
          {desktop?.name ?? 'No desktop'}
        </span>
        <AgentSwitcher className="flex shrink-0 gap-1" />
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          title="Settings"
          aria-label="Settings"
          onClick={() => setDesktopsOpen(true)}
        >
          <Settings className="size-5" />
        </Button>
      </header>

      {/* Row 2 onwards: the thread or session list, grouped by project. */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        {projects.length === 0 && (
          <div className="m-2 space-y-2 rounded-lg border p-3 text-muted-foreground text-xs">
            <p>
              {error
                ? `Could not read projects from ${desktop?.name ?? 'the desktop'}: ${error}`
                : `${desktop?.name ?? 'The desktop'} has no projects yet. Add one there and pull to refresh.`}
            </p>
            <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Retry'}
            </Button>
          </div>
        )}
        {acpActive ? (
          <SideBarAcpTab onStartNewSession={onNewInProject} />
        ) : selectedAgent === 'codex' ? (
          <SideBarCodexTab onCreateNewThread={onNewInProject} />
        ) : (
          <SideBarClaudeTab onStartNewSession={onNewInProject} />
        )}
      </div>

      {/* Thumb-reachable "new", where the desktop puts a header button. */}
      <Button
        size="icon"
        className="absolute right-5 bottom-6 size-14 rounded-full shadow-lg"
        title="New session"
        aria-label="New session"
        onClick={onNewSession}
      >
        <SquarePen className="size-6" />
      </Button>

      <DesktopDrawer open={desktopsOpen} onOpenChange={setDesktopsOpen} />
    </div>
  );
}
