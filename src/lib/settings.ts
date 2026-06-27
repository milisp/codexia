/**
 * Persistent settings backed by ~/.codexia/settings.json
 *
 * Usage:
 *   - Call loadSettings() before rendering the app (hydrates all stores from file)
 *   - Call initSettingsSync() once to subscribe stores → debounced file write
 *   - Both are called in App.tsx AppShell
 */

import { getHomeDirectory, readFile, writeFile } from '@/services/tauri';
import { fetchRemoteSettings } from '@/services/tauri/settings';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

const SETTINGS_FILE = '/.codexia/settings.json';
const SETTINGS_VERSION = 1;

// ── Types ────────────────────────────────────────────────────────────────────

type WorkspaceData = {
  projects: string[];
  historyProjects: string[];
  selectedAgent: string;
  cwd: string | undefined;
  projectSort: string;
  instructionType: string;
};

interface SettingsFile {
  version: number;
  workspace?: Partial<WorkspaceData>;
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

function applySettings(data: SettingsFile): void {
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
}

export async function loadSettings(): Promise<void> {
  const data = await readSettingsFile();
  if (!data) return;
  applySettings(data);
}

/** Load settings from the connected desktop via P2P API. Used on iOS. */
export async function loadRemoteSettings(): Promise<void> {
  try {
    const data = await fetchRemoteSettings();
    await applySettings(data as SettingsFile);
  } catch (err) {
    console.error('[settings] loadRemoteSettings failed:', err);
  }
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

function snapshot(): SettingsFile {
  const ws = useWorkspaceStore.getState();

  return {
    version: SETTINGS_VERSION,
    workspace: {
      projects: ws.projects,
      historyProjects: ws.historyProjects,
      selectedAgent: ws.selectedAgent,
      cwd: ws.cwd ?? undefined,
      projectSort: ws.projectSort,
      instructionType: ws.instructionType,
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
  const unsubs = [useWorkspaceStore.subscribe(scheduleWrite)];
  return () => unsubs.forEach((fn) => fn());
}
