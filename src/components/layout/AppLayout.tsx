import { Suspense, lazy, useEffect, useRef } from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useLayoutStore } from '@/stores';
import { SideBar } from '@/components/layout/SideBar';
import { RightPanel } from '@/components/layout/RightPanel';
import { AppHeader } from '@/components/layout';
import { History } from '@/components/codex/history';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomTerminal } from '../terminal/BottomTerminal';
import { useTrafficLightConfig } from '@/hooks';
import { useEdgeSwipe } from '@/hooks/useEdgeSwipe';
import { useProTrial } from '@/hooks/useProTrial';
import { openUrl } from '@tauri-apps/plugin-opener';

const SettingsView = lazy(() =>
  import('@/components/settings').then((module) => ({ default: module.SettingsView })),
);
const PluginsView = lazy(() => import('@/views/PluginsView'));
const AgentsMdView = lazy(() => import('@/views/agents-md-view'));
const AgentView = lazy(() => import('@/components/agent/AgentView'));
const LoginView = lazy(() => import('@/views/LoginView'));
const AutoMationsView = lazy(() =>
  import('../features/automations').then((module) => ({ default: module.AutoMationsView })),
);
const InsightsView = lazy(() => import('@/components/features/insight/InsightsView'));

// Inner component so it can call useSidebar() inside SidebarProvider
function LayoutContent({ mainContent }: { mainContent: React.ReactNode }) {
  const MIN_RIGHT_PANEL_SIZE = 22;
  const MAX_RIGHT_PANEL_SIZE = 75;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const {
    isSidebarOpen,
    setSidebarOpen,
    isRightPanelOpen,
    setRightPanelOpen,
    rightPanelSize,
    setRightPanelSize,
    view,
  } = useLayoutStore();
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const isMobile = useIsMobile();
  const hasInitializedMobileLayoutRef = useRef(false);
  const { needsTrafficLightOffset } = useTrafficLightConfig(isSidebarOpen);
  const { setOpenMobile } = useSidebar();

  useEdgeSwipe({ onSwipeRight: () => setOpenMobile(true), enabled: isMobile });

  useEffect(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (isMobile) {
      panel.collapse();
      return;
    }
    if (isRightPanelOpen) {
      const nextSize = clamp(rightPanelSize, MIN_RIGHT_PANEL_SIZE, MAX_RIGHT_PANEL_SIZE);
      panel.resize(nextSize);
      panel.expand();
      if (nextSize !== rightPanelSize) setRightPanelSize(nextSize);
    } else {
      panel.collapse();
    }
  }, [isMobile, isRightPanelOpen, rightPanelSize, setRightPanelSize]);

  useEffect(() => {
    if (!isMobile) {
      hasInitializedMobileLayoutRef.current = false;
      return;
    }
    if (hasInitializedMobileLayoutRef.current) return;
    hasInitializedMobileLayoutRef.current = true;
    if (isSidebarOpen) setSidebarOpen(false);
    if (isRightPanelOpen) setRightPanelOpen(false);
  }, [isMobile, isRightPanelOpen, isSidebarOpen, setRightPanelOpen, setSidebarOpen]);

  const handleRightPanelResize = (size: number) => {
    if (!isRightPanelOpen || size <= 0) return;
    const nextSize = clamp(size, MIN_RIGHT_PANEL_SIZE, MAX_RIGHT_PANEL_SIZE);
    if (nextSize !== rightPanelSize) setRightPanelSize(nextSize);
  };

  const showAppHeader = view === 'agent' || view === 'history';
  const triggerButton = (
    <div className={`absolute z-20 flex h-11 items-center ${needsTrafficLightOffset ? 'left-20 top-0' : 'left-0 top-0 pl-2'}`}>
      <SidebarTrigger />
    </div>
  );

  return (
    <SidebarInset className="min-w-0 overflow-hidden h-full">
      {showAppHeader ? (
        <AppHeader />
      ) : (
        (isMobile || !isSidebarOpen) && triggerButton
      )}
      <div className="relative flex flex-1 flex-col min-h-0 h-full">
        <ResizablePanelGroup
          direction="horizontal"
          className="flex min-h-0 min-w-0 w-full flex-1"
        >
          <ResizablePanel defaultSize={isRightPanelOpen && !isMobile ? 32 : 100} minSize={25}>
            {mainContent}
          </ResizablePanel>
          <ResizableHandle withHandle className={isMobile ? 'hidden' : ''} />
          <ResizablePanel
            ref={rightPanelRef}
            defaultSize={isRightPanelOpen && !isMobile ? rightPanelSize : 0}
            minSize={MIN_RIGHT_PANEL_SIZE}
            maxSize={MAX_RIGHT_PANEL_SIZE}
            onResize={handleRightPanelResize}
            collapsible
            collapsedSize={0}
            onCollapse={() => setRightPanelOpen(false)}
            onExpand={() => setRightPanelOpen(true)}
          >
            {!isMobile && <RightPanel />}
          </ResizablePanel>
        </ResizablePanelGroup>

        {isMobile && isRightPanelOpen && (
          <>
            <button
              type="button"
              className="absolute inset-0 z-30 bg-black/40"
              aria-label="Close right panel"
              onClick={() => setRightPanelOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 z-40 w-[min(92vw,420px)]">
              <RightPanel />
            </div>
          </>
        )}
      </div>
    </SidebarInset>
  );
}

const ViewLoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
    Loading view...
  </div>
);

export function AppLayout() {
  const { view, setView, isSidebarOpen, setSidebarOpen, isTerminalOpen, setIsTerminalOpen } = useLayoutStore();
  const { isPro, inTrial } = useProTrial();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setView('settings');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setView]);

  const mainContent = (
    <div className="flex flex-col min-w-0 h-full">
      <div className="min-h-0 flex-1">
        <Suspense fallback={<ViewLoadingFallback />}>
          {view === 'agents-md' && <AgentsMdView />}
          {view === 'agent' && <AgentView />}
          {view === 'automations' && <AutoMationsView />}
          {view === 'history' && <History />}
          {view === 'login' && <LoginView />}
          {view === 'plugins' && <PluginsView />}
          {view === 'insights' && (isPro || inTrial || import.meta.env.DEV ? <InsightsView /> : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="text-4xl">📊</div>
              <h2 className="text-lg font-semibold">Insights is a Pro feature</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Upgrade to Pro to unlock agent usage analytics, heatmaps, and rankings.
              </p>
              <button
                onClick={() => void openUrl('https://milisp.dev/pricing')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          ))}
        </Suspense>
      </div>
      {view === 'agent' && (
        <BottomTerminal open={isTerminalOpen} onOpenChange={setIsTerminalOpen} />
      )}
    </div>
  );

  return (
    <div className="h-[100dvh] w-full overflow-hidden">
      {view === 'settings' ? (
        <Suspense fallback={<ViewLoadingFallback />}>
          <SettingsView />
        </Suspense>
      ) : (
        <SidebarProvider
          open={isSidebarOpen}
          onOpenChange={setSidebarOpen}
          className="h-full min-h-0"
        >
          <SideBar />
          {/* Single layout component for both mobile and desktop.
              Keeping mainContent at a stable tree position prevents lazy views
              from unmounting/remounting when the viewport crosses the mobile breakpoint. */}
          <LayoutContent mainContent={mainContent} />
        </SidebarProvider>
      )}
    </div>
  );
}
