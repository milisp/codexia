import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { posthog } from '@/lib/posthog';
import type { AgentType } from './useWorkspaceStore';

let terminalCounter = 1;

export interface TerminalTab {
  id: string;
  label: string;
}

export type viewType =
  | 'automations'
  | 'agents-md'
  | 'agent'
  | 'learn'
  | 'plugins'
  | 'settings'
  | 'usage'
  | 'insights';

interface LayoutStore {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  isRightPanelOpen: boolean;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  rightPanelSize: number;
  setRightPanelSize: (size: number) => void;
  view: viewType;
  setView: (view: viewType) => void;
  // Focus mode: hides the left main content and lets the right panel fill the width
  isRightPanelFocused: boolean;
  setIsRightPanelFocused: (focused: boolean) => void;
  toggleRightPanelFocused: () => void;
  activeSidebarTab: AgentType;
  setActiveSidebarTab: (tab: AgentType) => void;
  activeRightPanelTab: 'diff' | 'tasks' | 'note' | 'files' | 'webpreview';
  setActiveRightPanelTab: (tab: 'diff' | 'tasks' | 'note' | 'files' | 'webpreview') => void;
  selectedAutomationTaskId: string | null;
  setSelectedAutomationTaskId: (taskId: string | null) => void;
  // Terminal tabs
  terminals: TerminalTab[];
  activeTerminalId: string | null;
  addTerminal: () => void;
  removeTerminal: (id: string) => void;
  setActiveTerminalId: (id: string) => void;
  // Derived: panel is open when at least one tab exists
  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
  diffWordWrap: boolean;
  setDiffWordWrap: (enabled: boolean) => void;
  diffSplitMode: boolean;
  setDiffSplitMode: (enabled: boolean) => void;
  // Sidebar project collapse state: projectPath -> isOpen
  expandedProjects: Record<string, boolean>;
  setProjectExpanded: (project: string, open: boolean) => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      isRightPanelOpen: false,
      toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
      setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
      rightPanelSize: 45,
      setRightPanelSize: (size) => set({ rightPanelSize: size }),
      view: 'agent',
      setView: (view) => {
        set({ view });
        posthog.capture('view_type', { view });
      },
      isRightPanelFocused: false,
      setIsRightPanelFocused: (focused: boolean) => set({ isRightPanelFocused: focused }),
      toggleRightPanelFocused: () =>
        set((state) => ({ isRightPanelFocused: !state.isRightPanelFocused })),
      activeSidebarTab: 'codex',
      setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
      activeRightPanelTab: 'diff',
      setActiveRightPanelTab: (tab) => set({ activeRightPanelTab: tab }),
      selectedAutomationTaskId: null,
      setSelectedAutomationTaskId: (taskId) => set({ selectedAutomationTaskId: taskId }),
      // Terminal tabs
      terminals: [],
      activeTerminalId: null,
      addTerminal: () =>
        set((state) => {
          const id = `term-${terminalCounter++}`;
          const label = `Terminal ${terminalCounter - 1}`;
          const tab: TerminalTab = { id, label };
          return {
            terminals: [...state.terminals, tab],
            activeTerminalId: id,
            isTerminalOpen: true,
          };
        }),
      removeTerminal: (id) =>
        set((state) => {
          const next = state.terminals.filter((t) => t.id !== id);
          const activeId =
            state.activeTerminalId === id
              ? (next[next.length - 1]?.id ?? null)
              : state.activeTerminalId;
          return {
            terminals: next,
            activeTerminalId: activeId,
            isTerminalOpen: next.length > 0,
          };
        }),
      setActiveTerminalId: (id) => set({ activeTerminalId: id }),
      isTerminalOpen: false,
      setIsTerminalOpen: (open) =>
        set((state) => {
          if (!open) return { isTerminalOpen: false };
          // Open: create first tab if none exist
          if (state.terminals.length > 0) return { isTerminalOpen: true };
          const id = `term-${terminalCounter++}`;
          const label = `Terminal ${terminalCounter - 1}`;
          return {
            terminals: [{ id, label }],
            activeTerminalId: id,
            isTerminalOpen: true,
          };
        }),
      diffWordWrap: false,
      setDiffWordWrap: (enabled) => set({ diffWordWrap: enabled }),
      diffSplitMode: false,
      setDiffSplitMode: (enabled) => set({ diffSplitMode: enabled }),
      expandedProjects: {},
      setProjectExpanded: (project, open) =>
        set((state) => ({
          expandedProjects: { ...state.expandedProjects, [project]: open },
        })),
    }),
    {
      name: 'layout-storage',
      version: 5,
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        isRightPanelOpen: state.isRightPanelOpen,
        rightPanelSize: state.rightPanelSize,
        view: state.view,
        isRightPanelFocused: state.isRightPanelFocused,
        activeSidebarTab: state.activeSidebarTab,
        activeRightPanelTab: state.activeRightPanelTab,
        diffWordWrap: state.diffWordWrap,
        diffSplitMode: state.diffSplitMode,
        expandedProjects: state.expandedProjects,
      }),
      migrate: (persistedState: any, version: number) => {
        if (version < 5) {
          if (persistedState && 'history' in persistedState) {
            delete persistedState.history;
          }
        }
        return persistedState;
      },
    }
  )
);
