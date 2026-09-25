import { useCallback, useEffect, useState } from 'react';
import CCMcpView from '@/components/cc/mcp/CCMcpView';
import type { McpServerConfig } from '@/components/codex/types';
import { CodexMcpView } from '@/features/mcp/CodexMcpView';
import { DefaultMcpServers } from '@/features/mcp/DefaultMcpServers';
import { McpAddPanel } from '@/features/mcp/McpAddPanel';
import { Clone } from '@/features/skills/Clone';
import { InstalledTab } from '@/features/skills/InstalledTab';
import SkillsViewContent from '@/features/skills/SkillsView';
import { RecommendToolsView } from '@/features/tools/RecommendToolsView';
import { unifiedReadMcpConfig } from '@/services';
import { useAgentSettingsStore, useWorkspaceStore } from '@/stores';
import { usePluginsViewContext } from '../hooks';
import { PluginDetailView } from './PluginDetailView';
import { PluginsMarketplaceView } from './PluginsMarketplaceView';
import { TabSwitcher } from './TabSwitcher';

/** Main content area: switches between Tools / MCP / Skills, or a manage / add overlay. */
export function PluginsViewContent() {
  const { selectedAgent } = useAgentSettingsStore();
  const { cwd } = useWorkspaceStore();
  const [quickAddServers, setQuickAddServers] = useState<Record<string, McpServerConfig>>({});
  const loadQuickAddServers = useCallback(async () => {
    try {
      // Claude's server list is per project; without a cwd there is nothing to read.
      if (selectedAgent === 'cc' && !cwd) {
        setQuickAddServers({});
        return;
      }
      const config = await unifiedReadMcpConfig(selectedAgent, cwd || undefined);
      setQuickAddServers((config.mcpServers as Record<string, McpServerConfig> | undefined) ?? {});
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    }
  }, [selectedAgent, cwd]);
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

  useEffect(() => {
    loadQuickAddServers();
  }, [loadQuickAddServers]);

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

      {!overlay && mainTab === 'MCP' && (
        <div className="flex-1 overflow-y-auto p-4">
          <DefaultMcpServers
            agent={selectedAgent}
            cwd={cwd || undefined}
            servers={quickAddServers}
            onServerAdded={() => {
              loadQuickAddServers();
              setRefreshTrigger((t: number) => t + 1);
            }}
          />
        </div>
      )}

      {overlay === 'manage' && (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5 mx-3 mt-2">
            <TabSwitcher
              tabs={['MCP', 'Skills'] as const}
              active={manageTab}
              onChange={setManageTab}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-3">
            {manageTab === 'MCP' ? (
              selectedAgent === 'codex' ? (
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
        <div className="flex-1 overflow-y-auto p-4">
          {addTab === 'MCP' ? <McpAddPanel onAdded={handleMcpAdded} /> : <Clone />}
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
