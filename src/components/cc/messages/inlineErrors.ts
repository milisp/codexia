import type { CCMessage, ContentBlock, ToolResultBlock } from '../types/messages';
import { isToolResultBlock } from '../types/messages';

/**
 * Collect tool_result errors from a user message that immediately follows an
 * assistant message, so they can be rendered inline in the assistant's tool badges.
 */
export function collectInlineErrors(
  messages: CCMessage[],
  idx: number
): Record<string, ToolResultBlock> | undefined {
  const msg = messages[idx];
  if (msg.type !== 'assistant') return undefined;

  // Find the next user message, skipping stream_events / system messages in between.
  let nextIdx = idx + 1;
  while (
    nextIdx < messages.length &&
    messages[nextIdx].type !== 'user' &&
    messages[nextIdx].type !== 'assistant'
  ) {
    nextIdx++;
  }
  const next = messages[nextIdx];
  if (!next || next.type !== 'user') return undefined;

  const blocks: ContentBlock[] = next.content ?? [];

  // Return undefined if no tool_result blocks in next user message (tools still in progress).
  const hasToolResults = blocks.some((b) => isToolResultBlock(b) && b.tool_use_id);
  if (!hasToolResults) return undefined;

  const errors: Record<string, ToolResultBlock> = {};
  for (const b of blocks) {
    if (isToolResultBlock(b) && b.is_error && b.tool_use_id) {
      errors[b.tool_use_id] = b;
    }
  }
  // Return {} (possibly empty) to signal message is completed even if no errors.
  return errors;
}

/**
 * Pre-compute inline errors map for the entire message list.
 */
export function buildInlineErrorsMap(
  messages: CCMessage[]
): Record<number, Record<string, ToolResultBlock>> {
  return messages.reduce<Record<number, Record<string, ToolResultBlock>>>((acc, _, idx) => {
    const errors = collectInlineErrors(messages, idx);
    if (errors) acc[idx] = errors;
    return acc;
  }, {});
}
