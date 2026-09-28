import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RunKind } from './detectProjectCommands';

type ProjectOverrides = Partial<Record<RunKind, string>>;

interface ProjectRunState {
  /** Per-project (cwd) user-edited command overrides, keyed by run kind. */
  overrides: Record<string, ProjectOverrides>;
  /** Set an override; passing an empty/whitespace command clears it. */
  setOverride: (cwd: string, kind: RunKind, command: string) => void;
}

export const useProjectRunStore = create<ProjectRunState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (cwd, kind, command) =>
        set((state) => {
          const trimmed = command.trim();
          const existing = state.overrides[cwd] ?? {};
          const nextForProject = { ...existing };
          if (trimmed) {
            nextForProject[kind] = trimmed;
          } else {
            delete nextForProject[kind];
          }
          return {
            overrides: { ...state.overrides, [cwd]: nextForProject },
          };
        }),
    }),
    {
      name: 'project-run-storage',
      version: 1,
    }
  )
);
