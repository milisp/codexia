import type { StateCreator } from 'zustand';
import { codexService } from '@/services/codexService';
import type { CodexStore, QueueSlice } from './types';

export const createQueueSlice: StateCreator<CodexStore, [], [], QueueSlice> = (set, get) => ({
  queuedMessages: [],
  isProcessingQueued: false,

  queueMessage: (text: string, images: string[]) => {
    set((state: CodexStore) => ({
      queuedMessages: [...state.queuedMessages, { text, images }],
    }));
  },

  getQueuedMessages: () => {
    return get().queuedMessages;
  },

  clearQueue: () => {
    set({ queuedMessages: [] });
  },

  removeQueuedMessage: (index: number) => {
    set((state: CodexStore) => {
      const newQueue = [...state.queuedMessages];
      newQueue.splice(index, 1);
      return { queuedMessages: newQueue };
    });
  },

  processQueue: async () => {
    // Prevent concurrent processing
    if (get().isProcessingQueued) {
      return;
    }

    set({ isProcessingQueued: true });

    try {
      // Process all queued messages
      while (get().queuedMessages.length > 0) {
        const { text, images } = get().queuedMessages[0];

        // Remove from queue
        set((state: CodexStore) => ({
          queuedMessages: state.queuedMessages.slice(1),
        }));

        // Skip if empty
        if (!text.trim() && images.length === 0) {
          continue;
        }

        // Get current thread ID
        const { currentThreadId } = get();
        if (!currentThreadId) {
          // No active thread, start a new one
          const thread = await codexService.threadStart();

          // Start turn with the message
          await codexService.turnStart(thread.id, text, images);
        } else {
          // We have an active thread, just start the turn
          await codexService.turnStart(currentThreadId, text, images);
        }

        // Small delay to prevent overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing queued messages:', error);
    } finally {
      set({ isProcessingQueued: false });
    }
  },

  setProcessingQueued: (isProcessing) => {
    set({ isProcessingQueued: isProcessing });
  },
});
