import { create } from 'zustand';
import type { RequestId } from '@/bindings';
import { respondToRequestUserInput } from '@/services';

type ToolRequestUserInputQuestion = {
  id: string;
  header?: string;
  question: string;
  options?: Array<{ label: string; description?: string }>;
  isOther?: boolean;
};

type ToolRequestUserInputResponse = {
  answers: Record<string, { answers: string[] }>;
};

export type RequestUserInputRequest = {
  requestId: RequestId;
  threadId: string;
  turnId: string;
  itemId: string;
  questions: ToolRequestUserInputQuestion[];
};

interface RequestUserInputStore {
  pendingRequests: RequestUserInputRequest[];
  currentRequest: RequestUserInputRequest | null;
  addRequest: (request: RequestUserInputRequest) => void;
  respondToRequest: (requestId: RequestId, response: ToolRequestUserInputResponse) => Promise<void>;
  clearCurrent: () => void;
}

export const useRequestUserInputStore = create<RequestUserInputStore>((set) => ({
  pendingRequests: [],
  currentRequest: null,
  addRequest: (request) => {
    set((state) => ({
      pendingRequests: [...state.pendingRequests, request],
      currentRequest: state.currentRequest || request,
    }));
  },
  respondToRequest: async (requestId, response) => {
    try {
      await respondToRequestUserInput(requestId, response);
      set((state) => {
        const pending = state.pendingRequests.filter((r) => r.requestId !== requestId);
        return {
          pendingRequests: pending,
          currentRequest: pending[0] || null,
        };
      });
    } catch (error: any) {
      console.error('Failed to respond to request_user_input:', error);
      throw error;
    }
  },
  clearCurrent: () => {
    set((state) => ({
      currentRequest: state.pendingRequests[1] || null,
      pendingRequests: state.pendingRequests.slice(1),
    }));
  },
}));
