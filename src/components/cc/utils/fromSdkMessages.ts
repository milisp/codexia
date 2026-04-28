import type { CCMessage } from '../types/messages';
import type { SdkSessionMessage } from '@/services/tauri/cc';

/**
 * Convert SDK SessionMessage[] (from the Rust get_session_messages call) into
 * CCMessage[] for use in the store. The SDK already handles:
 *   - parentUuid chain building (correct ordering, branch handling)
 *   - filtering out isMeta / isSidechain / teamName entries
 *
 * We only need to flatten the user message shape to match CCMessage.
 */
export function fromSdkMessages(sdkMessages: SdkSessionMessage[], sessionId: string): CCMessage[] {
  return sdkMessages.map((msg) => {
    if (msg.type === 'user') {
      const inner = msg.message as Record<string, unknown> | null | undefined;
      const content = inner?.content;
      const base: Record<string, unknown> = {
        type: 'user',
        uuid: msg.uuid,
        session_id: sessionId,
      };
      if (msg.parent_tool_use_id) base.parent_tool_use_id = msg.parent_tool_use_id;
      if (typeof content === 'string') {
        base.text = content;
      } else if (Array.isArray(content)) {
        base.content = content;
      }
      return base as unknown as CCMessage;
    }

    return {
      type: 'assistant',
      uuid: msg.uuid,
      session_id: sessionId,
      message: msg.message ?? { content: [] },
      ...(msg.parent_tool_use_id ? { parent_tool_use_id: msg.parent_tool_use_id } : {}),
    } as unknown as CCMessage;
  });
}
