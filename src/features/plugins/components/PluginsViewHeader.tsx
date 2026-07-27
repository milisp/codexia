import { ArrowLeft, MoreHorizontal, Plus, RotateCcw, Settings } from 'lucide-react';
import { AgentSwitcher } from '@/components/agent';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrafficLightConfig } from '@/hooks';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLayoutStore } from '@/stores';
import { usePluginsViewContext } from '../hooks/PluginsViewContext';
import { TabSwitcher } from './TabSwitcher';
import { SidebarTrigger } from '@/components/ui/sidebar';

/** Top toolbar: back button, tab switcher, manage/add actions, agent switcher. */
export function PluginsViewHeader() {
  const isMobile = useIsMobile();
  const { isSidebarOpen } = useLayoutStore();
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  const {
    mainTab,
    setMainTab,
    overlay,
    setOverlay,
    addTab,
    setAddTab,
    selectedDxt,
    setSelectedDxt,
    setRefreshTrigger,
  } = usePluginsViewContext();

  return (
    <div
      className={`flex items-center gap-1.5 p-1 ${needsTrafficLightOffset && 'pl-20'}`}
      data-tauri-drag-region
    >
      {!isSidebarOpen && <SidebarTrigger className="h-7 w-7" />}
      {/* Back button: shown in add overlay or dxt detail */}
      {(overlay === 'add' || (mainTab === 'MCP' && !overlay && selectedDxt)) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => (overlay === 'add' ? setOverlay('manage') : setSelectedDxt(null))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Tab switcher: shown in normal browsing */}
      {overlay === 'manage' ? (
        <Button variant="ghost" size="sm" onClick={() => setOverlay(null)}>
          <ArrowLeft className="h-4 w-4" />
          {isMobile ? '' : 'Plugin'}
        </Button>
      ) : overlay === 'add' ? (
        <TabSwitcher
          tabs={['MCP', 'Skill'] as const}
          active={addTab}
          onChange={setAddTab}
          showLabel={!isMobile}
        />
      ) : (
        !selectedDxt && (<>
          <TabSwitcher
            tabs={['Tools', 'Skills', 'MCP'] as const}
            active={mainTab}
            onChange={setMainTab}
            showLabel={!isMobile}
          /></>
        )
      )}

      <div className="flex-1" />

      {!overlay && !selectedDxt && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-sm"
          onClick={() => setOverlay('manage')}
        >
          <Settings className="h-3.5 w-3.5" />
          {isMobile ? '' : 'Manage'}
        </Button>
      )}

      <AgentSwitcher />

      {!overlay && !selectedDxt && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Add MCP server or install skill"
            onClick={() => {
              setAddTab(mainTab === 'Skills' ? 'Skill' : 'MCP');
              setOverlay('add');
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
                {mainTab === 'MCP'
                  ? 'Reload extensions'
                  : mainTab === 'Skills'
                    ? 'Refresh skills'
                    : 'Refresh tools'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
