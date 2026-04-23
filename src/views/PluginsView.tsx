import { useCallback, useEffect, useState } from 'react';
import { MCP } from '@/components/icons';
import { ArrowLeft, Blocks, MoreHorizontal, Package2, Plus, RotateCcw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DxtView from '@/components/features/dxt/DxtView';
import { PluginsCatalogView } from '@/components/features/plugins/PluginsCatalogView';
import SkillsViewContent from '@/components/features/skills/SkillsView';
import { Clone } from '@/components/features/skills/Clone';
import { CodexMcpView } from '@/components/features/mcp/CodexMcpView';
import CCMcpView from '@/components/cc/mcp/CCMcpView';
import { InstalledTab } from '@/components/features/skills/InstalledTab';
import { McpAddPanel } from '@/components/features/mcp/McpAddPanel';
import { McpConfigScopeSelector } from '@/components/cc/mcp/McpConfigScopeSelector';
import { useWorkspaceStore, useLayoutStore, usePluginStore } from '@/stores';
import { useTrafficLightConfig } from '@/hooks';
import {
  type SkillGroupsConfig,
  readSkillGroups,
  writeSkillGroups,
} from '@/services';
import { ProjectSelector } from '@/components/project-selector';
import { cn } from '@/lib/utils';
import { AgentSwitcher } from '@/components/agent';
import { useIsMobile } from '@/hooks/use-mobile';

type ActiveTab = 'MCP' | 'Skills' | 'Plugins' | 'manage' | 'add';
type ManageTab = 'Skills' | 'MCPs';
type AddTab = 'MCP' | 'Skill';
type SkillScope = 'user' | 'project';

function TabSwitcher<T extends string>({
  tabs,
  active,
  onChange,
  showLabel = true,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  showLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
      {tabs.map((t) => (
        <Button
          key={t}
          variant="ghost"
          size="sm"
          onClick={() => onChange(t)}
          className={`h-7 ${active === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          {t.startsWith('MCP') ? <MCP className="h-3.5 w-3.5" /> : t === 'Plugins' ? <Blocks className="h-4 w-4" /> : <Package2 className="h-4 w-4" />}
          {showLabel && ` ${t}`}
        </Button>
      ))}
    </div>
  );
}

export default function PluginsView() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<ActiveTab>('Plugins');
  const [manageTab, setManageTab] = useState<ManageTab>('MCPs');
  const [addTab, setAddTab] = useState<AddTab>('MCP');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [manageRefreshKey, setManageRefreshKey] = useState(0);
  const [groupsConfig, setGroupsConfig] = useState<SkillGroupsConfig>({ groups: [] });

  const { selectedAgent } = useWorkspaceStore();
  const { isSidebarOpen } = useLayoutStore();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  const { skillScope: scope, setSkillScope: setScope, selectedDxt, setSelectedDxt } = usePluginStore();

  useEffect(() => {
    readSkillGroups()
      .then(setGroupsConfig)
      .catch(() => { });
  }, []);

  const saveGroups = useCallback(async (config: SkillGroupsConfig) => {
    setGroupsConfig(config);
    await writeSkillGroups(config);
  }, []);

  const handleMcpAdded = useCallback(() => {
    setManageRefreshKey((k) => k + 1);
    setTab('manage');
    setManageTab('MCPs');
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className={`flex items-center gap-1.5 p-2 ${needsTrafficLightOffset && 'pl-32'}`} data-tauri-drag-region>

        {/* Back button: shown in add tab or dxt detail */}
        {(tab === 'add' || (tab === 'MCP' && selectedDxt)) && (
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => tab === 'add' ? setTab('manage') : setSelectedDxt(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Tab switcher: shown in normal browsing */}
        {tab === 'manage' ? (
          <Button variant="ghost" size="sm" onClick={() => setTab('MCP')}>
            <ArrowLeft className="h-4 w-4" />
            {isMobile ? '' : 'Plugin'}
          </Button>
        ) : (
          <>
            {tab !== 'add' && !selectedDxt && (
              <TabSwitcher tabs={['Plugins', 'Skills', 'MCP'] as const} active={tab as 'MCP' | 'Skills' | 'Plugins'} onChange={(t) => { setTab(t); }} showLabel={!isMobile} />
            )}
            {tab === 'add' && (
              <TabSwitcher tabs={['MCP', 'Skill'] as const} active={addTab} onChange={setAddTab} showLabel={!isMobile} />
            )}</>
        )}

        <div className="flex-1" />

        {tab !== 'add' && !selectedDxt && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 gap-1.5 text-sm ${tab === 'manage' ? 'bg-background text-foreground shadow-sm' : ''}`}
            onClick={() => setTab(tab === 'manage' ? 'MCP' : 'manage')}
          >
            <Settings className="h-3.5 w-3.5" />
            {isMobile ? '' : 'Manage'}
          </Button>
        )}

        <AgentSwitcher />

        {tab !== 'add' && !selectedDxt && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Add MCP server or install skill"
              onClick={() => {
                setAddTab(tab === 'Skills' ? 'Skill' : 'MCP');
                setTab('add');
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRefreshTrigger((k) => k + 1)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  {tab === 'MCP' ? 'Reload extensions' : tab === 'Skills' ? 'Refresh skills' : tab === 'Plugins' ? 'Refresh plugins' : 'Refresh'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'Plugins' && <PluginsCatalogView />}
        {tab === 'MCP' && <DxtView refreshTrigger={refreshTrigger} />}
        {tab === 'Skills' && <SkillsViewContent />}

        {tab === 'manage' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5 mx-3 mt-2">
              <TabSwitcher tabs={['MCPs', 'Skills'] as const} active={manageTab} onChange={setManageTab} />
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

        {tab === 'add' && (
          <div className="flex-1 overflow-y-auto p-4">
            {addTab === 'MCP'
              ? <McpAddPanel onAdded={handleMcpAdded} />
              : <Clone />
            }
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {(tab === 'Skills' || (tab === 'manage' && manageTab === 'Skills')) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t">
          Scope:
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
            {(['user', 'project'] as const).map((s) => (
              <Button
                key={s}
                variant="ghost"
                size="sm"
                onClick={() => setScope(s as SkillScope)}
                className={cn(
                  'h-6 px-2.5 text-[10px] uppercase tracking-wider',
                  scope === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {s}
              </Button>
            ))}
          </div>
          {scope === 'project' && <ProjectSelector />}
        </div>
      )}
      {(tab === 'MCP' || (tab === 'manage' && manageTab === 'MCPs')) && selectedAgent === 'cc' && (
        <div className="px-3 py-2 border-t">
          <McpConfigScopeSelector onProjectChange={() => setManageRefreshKey((k) => k + 1)} />
        </div>
      )}
    </div>
  );
}
