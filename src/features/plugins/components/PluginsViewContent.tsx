import { useCallback, useEffect, useRef, useState } from 'react';
import CCMcpView from '@/components/cc/mcp/CCMcpView';
import { CodexMcpView } from '@/features/mcp/CodexMcpView';
import { DefaultMcpServers } from '@/features/mcp/DefaultMcpServers';
import { KekeMcpView } from '@/features/mcp/KekeMcpView';
import { McpAddPanel } from '@/features/mcp/McpAddPanel';
import { Clone } from '@/features/skills/Clone';
import { InstalledTab } from '@/features/skills/InstalledTab';
import SkillsViewContent from '@/features/skills/SkillsView';
import { RecommendToolsView } from '@/features/tools/RecommendToolsView';
import { unifiedReadMcpConfig } from '@/services';
import { readKekeMcpServers } from '@/services/apiAdapt/kekeMcp';
import { useAgentSettingsStore, useWorkspaceStore } from '@/stores';
import { usePluginsViewContext } from '../hooks';
import { PluginDetailView } from './PluginDetailView';
import { PluginsMarketplaceView } from './PluginsMarketplaceView';
import { TabSwitcher } from './TabSwitcher';

/** Main content area: switches between Tools / Connectors / Skills, or a manage / add overlay. */
export function PluginsViewContent() {
  const { selectedAgent } = useAgentSettingsStore();
  const { cwd } = useWorkspaceStore();
  const { connectorTarget } = usePluginsViewContext();
  const quickAddRequest = useRef(0);
  const [quickAddState, setQuickAddState] = useState<{
    key: string;
    servers: Record<string, unknown>;
    error: string;
  }>({ key: '', servers: {}, error: '' });
  const targetKey = connectorTarget === 'bots' ? 'bots' : `${selectedAgent}:${cwd ?? ''}`;
  const loadQuickAddServers = useCallback(async () => {
    const request = ++quickAddRequest.current;
    try {
      const servers =
        connectorTarget === 'bots'
          ? await readKekeMcpServers()
          : selectedAgent === 'cc' && !cwd
            ? {}
            : ((await unifiedReadMcpConfig(selectedAgent, cwd || undefined)).mcpServers ?? {});
      if (request === quickAddRequest.current)
        setQuickAddState({ key: targetKey, servers, error: '' });
    } catch (error) {
      if (request === quickAddRequest.current)
        setQuickAddState({ key: targetKey, servers: {}, error: String(error) });
    }
  }, [selectedAgent, cwd, connectorTarget, targetKey]);
  const {
    mainTab,
    overlay,
    manageTab,
    setManageTab,
    addTab,
    setRefreshTrigger,
    refreshTrigger,
    manageRefreshKey,
    scope,
    groupsConfig,
    saveGroups,
    handleMcpAdded,
    selectedPluginDetail,
    installingPluginId,
    uninstallingPluginId,
    handlePluginInstall,
    handlePluginUninstall,
    handleUsePlugin,
  } = usePluginsViewContext();

  // biome-ignore lint/correctness/useExhaustiveDependencies: The shared refresh trigger intentionally reloads connector definitions.
  useEffect(() => {
    loadQuickAddServers();
  }, [loadQuickAddServers, refreshTrigger]);

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {/* Kept mounted under the detail overlay so going back does not reload the list. */}
      {(!overlay || overlay === 'detail') && mainTab === 'Plugins' && (
        <div className={overlay === 'detail' ? 'hidden' : 'h-full'}>
          <PluginsMarketplaceView refreshTrigger={refreshTrigger} />
        </div>
      )}
      {!overlay && mainTab === 'Skills' && <SkillsViewContent />}
      {!overlay && mainTab === 'Tools' && <RecommendToolsView />}

      {!overlay && mainTab === 'Connectors' && (
        <div className="h-full overflow-y-auto p-4">
          {quickAddState.key !== targetKey ? (
            <p className="text-sm text-muted-foreground">Loading connectors…</p>
          ) : quickAddState.error ? (
            <p role="alert" className="text-sm text-destructive">
              Could not load connectors: {quickAddState.error}
            </p>
          ) : (
            <DefaultMcpServers
              agent={connectorTarget === 'bots' ? 'keke' : selectedAgent}
              cwd={cwd || undefined}
              servers={quickAddState.servers}
              onServerAdded={() => {
                setRefreshTrigger((t: number) => t + 1);
              }}
            />
          )}
        </div>
      )}

      {overlay === 'manage' && (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5 mx-3 mt-2">
            <TabSwitcher
              tabs={['Connectors', 'Skills'] as const}
              active={manageTab}
              onChange={setManageTab}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-3">
            {manageTab === 'Connectors' ? (
              connectorTarget === 'bots' ? (
                <KekeMcpView refreshKey={manageRefreshKey + refreshTrigger} />
              ) : selectedAgent === 'codex' ? (
                <CodexMcpView refreshKey={manageRefreshKey} />
              ) : (
                <CCMcpView refreshKey={manageRefreshKey} />
              )
            ) : (
              <div className="px-4">
                <InstalledTab
                  searchQuery=""
                  scope={scope}
                  refreshKey={manageRefreshKey}
                  groupsConfig={groupsConfig}
                  onGroupsChange={saveGroups}
                  selectedGroupId={null}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {overlay === 'add' && (
        <div className="h-full overflow-y-auto p-4">
          {addTab === 'Connector' ? (
            <McpAddPanel
              key={connectorTarget}
              target={connectorTarget === 'bots' ? 'keke' : undefined}
              onAdded={handleMcpAdded}
            />
          ) : (
            <Clone />
          )}
        </div>
      )}

      {overlay === 'detail' && selectedPluginDetail && (
        <div className="h-full overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <PluginDetailView
              plugin={selectedPluginDetail}
              isInstalling={installingPluginId === selectedPluginDetail.summary.id}
              isUninstalling={uninstallingPluginId === selectedPluginDetail.summary.id}
              canInstall
              onInstall={() => handlePluginInstall(selectedPluginDetail)}
              onUninstall={() => handlePluginUninstall(selectedPluginDetail)}
              onUse={() => handleUsePlugin(selectedPluginDetail)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
