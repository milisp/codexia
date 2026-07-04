import { AddToNote, CopyButton } from '@/components/common';
import { Card } from '@/components/ui/card';
import { useCCStore } from '@/stores/cc';
import { useCCSettingsStore } from '@/stores/settings/useCCSettingsStore';
import type { CCMessage as CCMessageType, ToolResultBlock } from '../../types/messages';
import { isToolResultBlock } from '../../types/messages';
import type { PermissionDecision } from '../../types/permission';
import { CCMessageContent } from './CCMessageContent';
import { PermissionRequestCard } from './PermissionRequestCard';
import { RateLimitCard } from './RateLimitCard';
import { ResultCard } from './ResultCard';
import { SystemInitCard } from './SystemInitCard';
import { UserMessage } from './UserMessage';
import { safeStringify } from './utils';

interface CCMessageProps {
  message: CCMessageType;
  index: number;
  inlineErrors?: Record<string, ToolResultBlock>;
}

const isToolBlock = (b: { type: string }) => b.type === 'tool_use' || b.type === 'tool_result';

export function CCMessage({ message: msg, index: idx, inlineErrors }: CCMessageProps) {
  const { showPermissionCards } = useCCSettingsStore();
  const { updateMessage } = useCCStore();

  const handleResolvePermission = async (requestId: string, decision: PermissionDecision) => {
    const { ccResolvePermission } = await import('@/services');
    try {
      await ccResolvePermission(requestId, decision);
      updateMessage(idx, { resolved: decision } as any);
    } catch (err) {
      console.error('Failed to resolve permission:', err);
    }
  };

  switch (msg.type) {
    case 'assistant': {
      const assistantText = msg.message.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return (
        <div className="group flex items-start gap-1">
          {assistantText && (
            <div className="invisible group-hover:visible flex flex-col gap-0.5 shrink-0 pt-0.5">
              <CopyButton text={assistantText} className="h-4 w-4 text-muted-foreground" />
              <AddToNote text={assistantText} className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CCMessageContent
              msg={msg}
              index={idx}
              isToolBlock={isToolBlock}
              inlineErrors={inlineErrors}
            />
          </div>
        </div>
      );
    }

    case 'user': {
      if (msg.text) {
        return <UserMessage text={msg.text} />;
      }
      const errors = msg.content?.filter((b) => isToolResultBlock(b) && b.is_error) ?? [];
      if (errors.length === 0) return null;
      // Errors are rendered inline in the preceding assistant message's ToolUseBadges
      return null;
    }

    case 'permission_request':
      if (!showPermissionCards) return null;
      return <PermissionRequestCard msg={msg} onResolve={handleResolvePermission} />;

    case 'system':
      return msg.subtype === 'init' ? <SystemInitCard msg={msg} /> : null;

    case 'result':
      return <ResultCard msg={msg} />;

    case 'rate_limit_event':
      return <RateLimitCard msg={msg} />;

    case 'stream_event':
      return null;

    default:
      return (
        <Card className="p-3">
          <pre className="text-xs overflow-auto max-h-64">
            <code>{safeStringify(msg)}</code>
          </pre>
        </Card>
      );
  }
}
