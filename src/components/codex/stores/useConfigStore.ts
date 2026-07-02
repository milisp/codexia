import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReasoningEffort } from '@/bindings';
import type { AskForApproval, SandboxMode } from '@/bindings/v2';
import type { Provider } from '@/stores/settings';

export type Personality = 'friendly' | 'pragmatic';
export type ModeKind = 'default' | 'plan';
export type ThreadCwdMode = 'local' | 'worktree';

export interface ConfigStore {
  sandbox: SandboxMode;
  approvalPolicy: AskForApproval;
  reasoningEffort: ReasoningEffort;
  webSearchRequest: boolean;
  modelProvider: Provider;
  model: string;
  // Last-used model id per provider key (e.g. { openai: 'o3', custom: 'my-model' })
  providerModels: Record<string, string>;
  personality: Personality | null;
  collaborationMode: ModeKind;
  threadCwdMode: ThreadCwdMode;
  setModel: (model: string) => void;
  setModelProvider: (provider: Provider) => void;
  setAccessMode: (sandbox: SandboxMode) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setWebSearch: (webSearchRequest: boolean) => void;
  setPersonality: (personality: Personality | null) => void;
  setCollaborationMode: (mode: ModeKind) => void;
  setThreadCwdMode: (mode: ThreadCwdMode) => void;
}

export const SANDBOX_APPROVAL_MAP: Record<SandboxMode, AskForApproval> = {
  'read-only': 'untrusted',
  'workspace-write': 'on-request',
  'danger-full-access': 'never',
};

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      webSearchRequest: false,
      sandbox: 'workspace-write',
      approvalPolicy: 'on-request',
      reasoningEffort: 'medium',
      modelProvider: 'openai',
      model: '',
      providerModels: {},
      personality: 'friendly',
      collaborationMode: 'default',
      threadCwdMode: 'local',

      setModel: (model: string) => {
        set((state) => ({
          model,
          providerModels: { ...state.providerModels, [state.modelProvider]: model },
        }));
      },

      setModelProvider: (modelProvider: Provider) => {
        set((state) => ({
          modelProvider,
          model: state.providerModels[modelProvider] ?? '',
        }));
      },

      setAccessMode: (sandbox: SandboxMode) => {
        const approvalPolicy = SANDBOX_APPROVAL_MAP[sandbox];
        set({ sandbox, approvalPolicy });
      },

      setReasoningEffort: (effort: ReasoningEffort) => {
        set({ reasoningEffort: effort });
      },

      setWebSearch: (webSearchRequest: boolean) => {
        set({ webSearchRequest });
      },

      setPersonality: (personality: Personality | null) => {
        set({ personality });
      },

      setCollaborationMode: (mode: ModeKind) => {
        set({ collaborationMode: mode });
      },

      setThreadCwdMode: (mode: ThreadCwdMode) => {
        set({ threadCwdMode: mode });
      },
    }),
    {
      name: 'codex-config-storage',
    }
  )
);
