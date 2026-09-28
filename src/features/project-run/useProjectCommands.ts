import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { detectProjectCommands, type ProjectCommands } from './detectProjectCommands';
import { useProjectRunStore } from './useProjectRunStore';

export interface UseProjectCommandsResult {
  /** Detected defaults, before overrides are applied. */
  defaults: ProjectCommands;
  /** Detected defaults merged with the user's saved overrides for this project. */
  commands: ProjectCommands;
}

/** Detects default run commands for the current project and merges in user overrides. */
export function useProjectCommands(): UseProjectCommandsResult {
  const { cwd } = useWorkspaceStore();
  const overridesForCwd = useProjectRunStore((state) => (cwd ? state.overrides[cwd] : undefined));
  const [defaults, setDefaults] = useState<ProjectCommands>({});

  useEffect(() => {
    let cancelled = false;
    if (!cwd) {
      setDefaults({});
      return;
    }
    void detectProjectCommands(cwd).then((detected) => {
      if (!cancelled) setDefaults(detected);
    });
    return () => {
      cancelled = true;
    };
  }, [cwd]);

  const commands: ProjectCommands = { ...defaults, ...overridesForCwd };

  return { defaults, commands };
}
