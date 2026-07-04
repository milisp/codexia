import type {
  AssistantMessage,
  CCMessage,
  ContentBlock,
  ToolResultBlock,
  ToolUseBlock,
} from '../../types/messages';
import { isToolResultBlock } from '../../types/messages';
import { ExploredGroup } from './ExploredGroup';

export const SILENT_TOOLS = new Set(['Read', 'Glob', 'Grep']);

/**
 * Returns true if the assistant message contains only SILENT_TOOL tool_uses
 * (Read/Grep/Glob) and no non-empty text blocks. These are grouped across
 * consecutive messages into a single ExploredGroup.
 */
export function isSilentOnlyMessage(msg: CCMessage): msg is AssistantMessage {
  if (msg.type !== 'assistant') return false;
  const blocks = msg.message.content;
  const toolUses = blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use');
  if (toolUses.length === 0) return false;
  const hasNonSilent = toolUses.some((b) => !SILENT_TOOLS.has(b.name));
  const hasText = blocks.some(
    (b) => b.type === 'text' && (b as { text: string }).text.trim().length > 0
  );
  return !hasNonSilent && !hasText;
}

/**
 * Returns true if the user message should be hidden from the message list.
 * Pure tool_result error messages are rendered inline in the preceding assistant message.
 */
export function shouldSkipUserMessage(msg: CCMessage): boolean {
  if (msg.type !== 'user') return false;
  if (msg.text) return false;

  const blocks: ContentBlock[] = msg.content ?? [];
  return blocks.length > 0 && blocks.every((b) => isToolResultBlock(b) && b.is_error);
}

// ---------------------------------------------------------------------------
// Message grouping
// ---------------------------------------------------------------------------

export type MessageGroup =
  | { kind: 'message'; msgIdx: number }
  | { kind: 'explored'; msgIndices: number[] };

/**
 * Group consecutive silent-only assistant messages (Read/Grep/Glob only) into
 * ExploredGroup entries. Pure tool_result user messages between them are
 * transparent to the grouping logic.
 */
export function buildMessageGroups(messages: CCMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (isSilentOnlyMessage(msg)) {
      const msgIndices: number[] = [];

      while (i < messages.length) {
        const m = messages[i];
        const mType = m.type;
        if (isSilentOnlyMessage(m)) {
          msgIndices.push(i);
          i++;
        } else if (
          mType === 'assistant' || // non-silent assistant
          (mType === 'user' && !!(m as { text?: string }).text) || // user typed something
          mType === 'result' // session finished
        ) {
          break;
        } else {
          // Transparent: user tool_results, stream_events, system, etc.
          i++;
        }
      }

      groups.push({ kind: 'explored', msgIndices });
    } else {
      if (!shouldSkipUserMessage(msg)) {
        groups.push({ kind: 'message', msgIdx: i });
      }
      i++;
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// CCExploredMessageGroup
// ---------------------------------------------------------------------------

export interface ExploredMessageGroupProps {
  msgIndices: number[];
  messages: CCMessage[];
  inlineErrorsMap: Record<number, Record<string, ToolResultBlock>>;
}

export function CCExploredMessageGroup({
  msgIndices,
  messages,
  inlineErrorsMap,
}: ExploredMessageGroupProps) {
  const items = msgIndices.flatMap((idx) => {
    const msg = messages[idx] as AssistantMessage;
    const errors = inlineErrorsMap[idx];
    return msg.message.content
      .filter((b): b is ToolUseBlock => b.type === 'tool_use' && SILENT_TOOLS.has(b.name))
      .map((block) => ({ block, inlineError: errors?.[block.id] ?? null }));
  });

  // Group is completed when every message in the group has received tool_results.
  const isCompleted = msgIndices.every((idx) => inlineErrorsMap[idx] !== undefined);

  return <ExploredGroup items={items} isCompleted={isCompleted} />;
}

// ---------------------------------------------------------------------------
// Message Block grouping
// ---------------------------------------------------------------------------

export type RenderItem =
  | {
    kind: 'single';
    block: ContentBlock;
    blockIndex: number;
    inlineError: ToolResultBlock | null;
    mt: string;
  }
  | {
    kind: 'explored';
    items: Array<{ block: ToolUseBlock; inlineError: ToolResultBlock | null }>;
    mt: string;
    isLocallyCompleted: boolean;
  };

export function buildRenderItems(
  blocks: ContentBlock[],
  isToolBlock: (b: { type: string }) => boolean,
  inlineErrors?: Record<string, ToolResultBlock>
): RenderItem[] {
  const result: RenderItem[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const prevBlock = i > 0 ? blocks[i - 1] : null;
    const mt =
      i === 0 ? '' : isToolBlock(block) && prevBlock && isToolBlock(prevBlock) ? 'mt-0.5' : 'mt-2';

    if (block.type === 'tool_use' && SILENT_TOOLS.has(block.name)) {
      // Collect consecutive SILENT_TOOL tool_use blocks into one ExploredGroup.
      const groupItems: Array<{ block: ToolUseBlock; inlineError: ToolResultBlock | null }> = [];
      while (
        i < blocks.length &&
        blocks[i].type === 'tool_use' &&
        SILENT_TOOLS.has((blocks[i] as ToolUseBlock).name)
      ) {
        const b = blocks[i] as ToolUseBlock;
        groupItems.push({ block: b, inlineError: inlineErrors?.[b.id] ?? null });
        i++;
      }
      // If any block follows the group in this message, exploration phase is over.
      const isLocallyCompleted = i < blocks.length;
      result.push({ kind: 'explored', items: groupItems, mt, isLocallyCompleted });
    } else {
      const inlineError = block.type === 'tool_use' ? (inlineErrors?.[block.id] ?? null) : null;
      result.push({ kind: 'single', block, blockIndex: i, inlineError, mt });
      i++;
    }
  }

  return result;
}
