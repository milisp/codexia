import { CCMessageBlock } from '@/components/cc/messages/CCMessageBlock';
import { ExploredGroup } from '@/components/cc/messages/ExploredGroup';
import { useCCStore } from '@/stores/cc';
import type { AssistantMessage, ToolResultBlock, ToolUseBlock } from '../types/messages';
import { buildRenderItems } from './group';

interface Props {
  msg: AssistantMessage;
  index?: number;
  isToolBlock: (b: { type: string }) => boolean;
  inlineErrors?: Record<string, ToolResultBlock>;
}

export function CCMessageContent({ msg, isToolBlock, inlineErrors }: Props) {
  const { messages } = useCCStore();

  const resolveToolName = (toolUseId: string): string | undefined => {
    const inMsg = msg.message.content.find(
      (b): b is ToolUseBlock => b.type === 'tool_use' && b.id === toolUseId
    );
    if (inMsg) return inMsg.name;
    for (const m of messages) {
      if (m.type !== 'assistant') continue;
      const found = m.message.content.find(
        (b): b is ToolUseBlock => b.type === 'tool_use' && b.id === toolUseId
      );
      if (found) return found.name;
    }
  };

  // inlineErrors !== undefined means the next user message with tool_results has arrived.
  const isCompleted = inlineErrors !== undefined;

  const renderItems = buildRenderItems(msg.message.content, isToolBlock, inlineErrors);

  return (
    <div className="flex flex-col">
      {msg.message.error && (
        <div className="text-xs text-red-500 px-1 mb-2">Error: {msg.message.error}</div>
      )}
      {renderItems.map((item, gi) => (
        <div key={gi} className={item.mt}>
          {item.kind === 'explored' ? (
            <ExploredGroup
              items={item.items}
              isCompleted={isCompleted || item.isLocallyCompleted}
            />
          ) : (
            <CCMessageBlock
              block={item.block}
              index={item.blockIndex}
              inlineError={item.inlineError}
              toolName={
                item.block.type === 'tool_use'
                  ? item.block.name
                  : item.block.type === 'tool_result'
                    ? resolveToolName(item.block.tool_use_id)
                    : undefined
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
