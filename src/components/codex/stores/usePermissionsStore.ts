import { create } from 'zustand';
import type { RequestId } from '@/bindings';
import type { PermissionGrantScope, PermissionsRequestApprovalParams } from '@/bindings/v2';
import { respondToPermissionsApproval } from '@/services';

export type PermissionsRequest = PermissionsRequestApprovalParams & {
  requestId: RequestId;
};

export type PermissionsDecision =
  | { kind: 'grantTurn' }
  | { kind: 'grantTurnStrict' }
  | { kind: 'grantSession' }
  | { kind: 'deny' };

interface PermissionsStore {
  pendingRequests: PermissionsRequest[];
  addRequest: (request: PermissionsRequest) => void;
  respond: (request: PermissionsRequest, decision: PermissionsDecision) => Promise<void>;
}

export const usePermissionsStore = create<PermissionsStore>((set) => ({
  pendingRequests: [],
  addRequest: (request) => {
    set((state) => ({ pendingRequests: [...state.pendingRequests, request] }));
  },
  respond: async (request, decision) => {
    // Denying grants an empty profile rather than sending a decision field —
    // mirrors codex-rs `handle_permissions_decision`.
    const permissions = decision.kind === 'deny' ? {} : request.permissions;
    const scope: PermissionGrantScope = decision.kind === 'grantSession' ? 'session' : 'turn';
    try {
      await respondToPermissionsApproval(
        request.requestId,
        permissions,
        scope,
        decision.kind === 'grantTurnStrict'
      );
    } finally {
      set((state) => ({
        pendingRequests: state.pendingRequests.filter((r) => r.requestId !== request.requestId),
      }));
    }
  },
}));
