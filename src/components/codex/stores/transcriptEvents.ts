import type { ServerNotification } from '@/bindings';

// Notifications kept in a thread's transcript (`events[threadId]`). Everything
// else still updates derived state in `addEvent`, but never reaches the
// transcript, so new app-server notifications stay out of the chat until a
// renderer is written for them.
const TRANSCRIPT_METHODS = new Set<ServerNotification['method']>([
  'error',
  'warning',
  'thread/started',
  'thread/status/changed',
  'thread/tokenUsage/updated',
  'thread/goal/updated',
  'thread/goal/cleared',
  'turn/started',
  'turn/completed',
  'turn/plan/updated',
  'turn/diff/updated',
  'item/started',
  'item/completed',
  'item/agentMessage/delta',
  'item/commandExecution/terminalInteraction',
]);

export const isTranscriptEvent = (event: ServerNotification): boolean =>
  TRANSCRIPT_METHODS.has(event.method);
