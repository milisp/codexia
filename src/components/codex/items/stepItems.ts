import type { ThreadItem } from '@/bindings/v2';

/** Thread items shown as one-line "steps" (tool calls, commands, thinking) in the transcript. */
export type StepItem = Extract<
  ThreadItem,
  {
    type:
      | 'reasoning'
      | 'commandExecution'
      | 'mcpToolCall'
      | 'dynamicToolCall'
      | 'webSearch'
      | 'imageView'
      | 'imageGeneration'
      | 'contextCompaction'
      | 'functionCallOutput'
      | 'hookPrompt'
      | 'sleep'
      | 'collabAgentToolCall'
      | 'subAgentActivity';
  }
>;

const STEP_TYPES = new Set<ThreadItem['type']>([
  'reasoning',
  'commandExecution',
  'mcpToolCall',
  'dynamicToolCall',
  'webSearch',
  'imageView',
  'imageGeneration',
  'contextCompaction',
  'functionCallOutput',
  'hookPrompt',
  'sleep',
  'collabAgentToolCall',
  'subAgentActivity',
]);

export const isStepItem = (item: ThreadItem): item is StepItem => STEP_TYPES.has(item.type);

/** True when the step ended in an error, so groups can report failures. */
export function isStepFailed(item: StepItem): boolean {
  switch (item.type) {
    case 'commandExecution':
      return (
        item.status === 'failed' ||
        item.status === 'declined' ||
        (item.status === 'completed' && item.exitCode !== null && item.exitCode !== 0)
      );
    case 'mcpToolCall':
    case 'dynamicToolCall':
    case 'collabAgentToolCall':
      return item.status === 'failed';
    case 'imageGeneration':
      return item.failure !== null && item.failure !== undefined;
    default:
      return false;
  }
}
