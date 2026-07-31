import { create } from 'zustand';

export type AgentType = 'codex' | 'cc';
export const AGENT_TYPES: AgentType[] = ['cc', 'codex'];

interface AgentSettingsStore {
  selectedAgent: AgentType;
  setSelectedAgent: (agent: AgentType) => void;
  instructionType: string;
  setInstructionType: (type: string) => void;
}

export const useAgentSettingsStore = create<AgentSettingsStore>((set) => ({
  selectedAgent: 'codex',
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  instructionType: 'system',
  setInstructionType: (type) => set({ instructionType: type }),
}));
