import CCMcpView from '@/components/cc/mcp/CCMcpView';
import DxtView from '@/features/dxt/DxtView';
import { CodexMcpView } from '@/features/mcp/CodexMcpView';
import { McpAddPanel } from '@/features/mcp/McpAddPanel';
import { Clone } from '@/features/skills/Clone';
import { InstalledTab } from '@/features/skills/InstalledTab';
import SkillsViewContent from '@/features/skills/SkillsView';
import { RecommendToolsView } from '@/features/tools/RecommendToolsView';
import { PluginsMarketplaceView } from './PluginsMarketplaceView';
import { useWorkspaceStore } from '@/stores';
import { usePluginsViewContext } from '../hooks/PluginsViewContext';
import { TabSwitcher } from './TabSwitcher';

/** Main content area: switches between Tools / MCP / Skills, or a manage / add overlay. */
export function PluginsViewContent() {
  const { selectedAgent } = useWorkspaceStore();
  const {
    mainTab,
    overlay,
    manageTab,
    setManageTab,
    addTab,
    refreshTrigger,
    manageRefreshKey,
    scope,
    groupsConfig,
    saveGroups,
    handleMcpAdded,
  } = usePluginsViewContext();

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {!overlay && mainTab === 'Plugins' && <PluginsMarketplaceView mode="browse" refreshTrigger={refreshTrigger} />}
      {!overlay && mainTab === 'Skills' && <SkillsViewContent />}
      {!overlay && mainTab === 'Tools' && <RecommendToolsView />}
      {!overlay && mainTab === 'MCP' && <DxtView refreshTrigger={refreshTrigger} />}

      {overlay === 'manage' && (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5 mx-3 mt-2">
            <TabSwitcher
              tabs={['MCPs', 'Skills'] as const}
              active={manageTab}
              onChange={setManageTab}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-3">
            {manageTab === 'MCPs' ? (
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
    </div>
  );
}
