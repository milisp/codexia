/**
 * Persistent settings backed by ~/.codexia/settings.json
 *
 * Usage:
 *   - Call loadSettings() before rendering the app (hydrates all stores from file)
 *   - Call initSettingsSync() once to subscribe stores → debounced file write
 *   - Both are called in App.tsx AppShell
 */

import { getHomeDirectory, readFile, writeFile } from '@/services/tauri';
import type { SandboxMode, AskForApproval } from '@/bindings/v2';
import type { ReasoningEffort } from '@/bindings';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/settings/useSettingsStore';
import { useThemeStore } from '@/stores/settings/useThemeStore';
import { useLocaleStore } from '@/stores/settings/useLocaleStore';
import { useLayoutStore } from '@/stores/settings/useLayoutStore';
import { useConfigStore } from '@/stores/codex/useConfigStore';

const SETTINGS_FILE = '/.codexia/settings.json';
const SETTINGS_VERSION = 1;

// ── Types ────────────────────────────────────────────────────────────────────

type WorkspaceData = {
  projects: string[];
  historyProjects: string[];
  selectedAgent: string;
  cwd: string;
  projectSort: string;
  instructionType: string;
};

type ThemeData = {
  theme: string;
  accent: string;
};

type LayoutData = {
  activeSidebarTab: string;
};

type AppData = {
  hiddenNames: string[];
  showExplorer: boolean;
  taskDetail: string;
  autoCommitGitWorktree: boolean;
  enableTaskCompleteBeep: string;
  preventSleepDuringTasks: boolean;
  showReasoning: boolean;
  enabledQuoteCategories: string[];
  showSidebarMarketplace: boolean;
  showHeaderTerminalButton: boolean;
  showHeaderWebPreviewButton: boolean;
  showHeaderNotesButton: boolean;
  showHeaderFilesButton: boolean;
  showHeaderDiffButton: boolean;
  showQuotes: boolean;
  showTips: boolean;
  analyticsEnabled: boolean;
  analyticsConsentShown: boolean;
  customStunServers: string[];
  p2pAutoStart: boolean;
};

type CodexConfigData = {
  modelProvider: 'openai' | 'ollama';
  model: string;
  openaiModel: string;
  ollamaModel: string;
  sandbox: SandboxMode;
  approvalPolicy: AskForApproval;
  reasoningEffort: ReasoningEffort;
  webSearchRequest: boolean;
  personality: 'friendly' | 'pragmatic' | null;
  collaborationMode: 'default' | 'plan';
  threadCwdMode: 'local' | 'worktree';
};

interface SettingsFile {
  version: number;
  workspace?: Partial<WorkspaceData>;
  theme?: Partial<ThemeData>;
  layout?: Partial<LayoutData>;
  locale?: { locale?: string };
  app?: Partial<AppData>;
  codexConfig?: Partial<CodexConfigData>;
}

// ── File I/O ─────────────────────────────────────────────────────────────────

let filePath: string | null = null;

async function getFilePath(): Promise<string> {
  if (!filePath) {
    filePath = (await getHomeDirectory()) + SETTINGS_FILE;
  }
  return filePath;
}

async function readSettingsFile(): Promise<SettingsFile | null> {
  try {
    const path = await getFilePath();
    const raw = await readFile(path, { suppressToast: true });
    return JSON.parse(raw) as SettingsFile;
  } catch {
    return null;
  }
}

// ── Hydration ─────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<void> {
  const data = await readSettingsFile();
  if (!data) return;

  if (data.workspace) {
    const ws = data.workspace;
    useWorkspaceStore.setState({
      ...(ws.projects !== undefined && { projects: ws.projects }),
      ...(ws.historyProjects !== undefined && { historyProjects: ws.historyProjects }),
      ...(ws.selectedAgent !== undefined && { selectedAgent: ws.selectedAgent as never }),
      ...(ws.cwd !== undefined && { cwd: ws.cwd }),
      ...(ws.projectSort !== undefined && { projectSort: ws.projectSort as never }),
      ...(ws.instructionType !== undefined && { instructionType: ws.instructionType }),
    });
  }

  if (data.theme) {
    const t = data.theme;
    useThemeStore.setState({
      ...(t.theme !== undefined && { theme: t.theme as never }),
      ...(t.accent !== undefined && { accent: t.accent as never }),
    });
  }

  if (data.layout?.activeSidebarTab !== undefined) {
    useLayoutStore.setState({ activeSidebarTab: data.layout.activeSidebarTab as never });
  }

  if (data.locale?.locale !== undefined) {
    useLocaleStore.setState({ locale: data.locale.locale as never });
  }

  if (data.app) {
    useSettingsStore.setState(data.app as never);
  }

  if (data.codexConfig) {
    useConfigStore.setState(data.codexConfig as never);
  }
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

function snapshot(): SettingsFile {
  const ws = useWorkspaceStore.getState();
  const theme = useThemeStore.getState();
  const layout = useLayoutStore.getState();
  const locale = useLocaleStore.getState();
  const app = useSettingsStore.getState();
  const config = useConfigStore.getState();

  return {
    version: SETTINGS_VERSION,
    workspace: {
      projects: ws.projects,
      historyProjects: ws.historyProjects,
      selectedAgent: ws.selectedAgent,
      cwd: ws.cwd,
      projectSort: ws.projectSort,
      instructionType: ws.instructionType,
    },
    theme: {
      theme: theme.theme,
      accent: theme.accent,
    },
    layout: {
      activeSidebarTab: layout.activeSidebarTab,
    },
    locale: {
      locale: locale.locale,
    },
    app: {
      hiddenNames: app.hiddenNames,
      showExplorer: app.showExplorer,
      taskDetail: app.taskDetail,
      autoCommitGitWorktree: app.autoCommitGitWorktree,
      enableTaskCompleteBeep: app.enableTaskCompleteBeep,
      preventSleepDuringTasks: app.preventSleepDuringTasks,
      showReasoning: app.showReasoning,
      enabledQuoteCategories: app.enabledQuoteCategories,
      showSidebarMarketplace: app.showSidebarMarketplace,
      showHeaderTerminalButton: app.showHeaderTerminalButton,
      showHeaderWebPreviewButton: app.showHeaderWebPreviewButton,
      showHeaderNotesButton: app.showHeaderNotesButton,
      showHeaderFilesButton: app.showHeaderFilesButton,
      showHeaderDiffButton: app.showHeaderDiffButton,
      showQuotes: app.showQuotes,
      showTips: app.showTips,
      analyticsEnabled: app.analyticsEnabled,
      analyticsConsentShown: app.analyticsConsentShown,
      customStunServers: app.customStunServers,
      p2pAutoStart: app.p2pAutoStart,
    },
    codexConfig: {
      modelProvider: config.modelProvider,
      model: config.model,
      openaiModel: config.openaiModel,
      ollamaModel: config.ollamaModel,
      sandbox: config.sandbox,
      approvalPolicy: config.approvalPolicy,
      reasoningEffort: config.reasoningEffort,
      webSearchRequest: config.webSearchRequest,
      personality: config.personality,
      collaborationMode: config.collaborationMode,
      threadCwdMode: config.threadCwdMode,
    },
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

let writeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWrite(): void {
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    try {
      const path = await getFilePath();
      await writeFile(path, JSON.stringify(snapshot(), null, 2));
    } catch (err) {
      console.error('[settings] write failed:', err);
    }
  }, 300);
}

// ── Sync ──────────────────────────────────────────────────────────────────────

/** Subscribe all tracked stores. Returns an unsubscribe function. */
export function initSettingsSync(): () => void {
  const unsubs = [
    useWorkspaceStore.subscribe(scheduleWrite),
    useThemeStore.subscribe(scheduleWrite),
    useLayoutStore.subscribe(scheduleWrite),
    useLocaleStore.subscribe(scheduleWrite),
    useSettingsStore.subscribe(scheduleWrite),
    useConfigStore.subscribe(scheduleWrite),
  ];
  return () => unsubs.forEach((fn) => fn());
}
