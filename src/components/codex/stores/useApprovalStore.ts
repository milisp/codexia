import { create } from 'zustand';
import type {
  CommandExecutionApprovalDecision,
  CommandExecutionRequestApprovalParams,
  FileChangeApprovalDecision,
  FileChangeRequestApprovalParams,
} from '@/bindings/v2';
import { RequestId } from '@/bindings';
import { respondToCommandExecutionApproval, respondToFileChangeApproval } from '@/services';

export type ApprovalRequest =
  | (CommandExecutionRequestApprovalParams & {
      type: 'commandExecution';
      requestId: RequestId;
    })
  | (FileChangeRequestApprovalParams & {
      type: 'fileChange';
      requestId: RequestId;
    });

interface ApprovalStore {
  // State
  pendingApprovals: ApprovalRequest[];
  currentApproval: ApprovalRequest | null;

  // Actions
  addApproval: (approval: ApprovalRequest) => void;
  respondToApproval: (
    requestId: RequestId,
    isCommandExecution: boolean,
    decision: CommandExecutionApprovalDecision | FileChangeApprovalDecision
  ) => Promise<void>;
  clearCurrent: () => void;
}

export const useApprovalStore = create<ApprovalStore>((set, _get) => ({
  // Initial state
  pendingApprovals: [],
  currentApproval: null,

  // Actions
  addApproval: (approval) => {
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals, approval],
      currentApproval: state.currentApproval || approval,
    }));
  },

  respondToApproval: async (requestId, isCommandExecution, decision) => {
    try {
      if (isCommandExecution) {
        await respondToCommandExecutionApproval(
          requestId,
          decision as CommandExecutionApprovalDecision
        );
      } else {
        await respondToFileChangeApproval(requestId, decision as FileChangeApprovalDecision);
      }

      // Remove from pending
      set((state) => {
        const pending = state.pendingApprovals.filter((a) => a.requestId !== requestId);
        return {
          pendingApprovals: pending,
          currentApproval: pending[0] || null,
        };
      });
    } catch (error: any) {
      console.error('Failed to respond to approval:', error);
      throw error;
    }
  },

  clearCurrent: () => {
    set((state) => ({
      currentApproval: state.pendingApprovals[1] || null,
      pendingApprovals: state.pendingApprovals.slice(1),
    }));
  },
}));
