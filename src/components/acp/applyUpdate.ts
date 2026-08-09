import { useAcpStore } from '@/stores/useAcpStore';

/**
 * Fold one `session/update` payload into the store. Shared by the live event
 * bridge and the replay of a stored transcript, so both render identically.
 */
export function applyAcpUpdate(update: Record<string, any>) {
  const store = useAcpStore.getState();
  switch (update.sessionUpdate) {
    case 'user_message_chunk':
      // Only stored transcripts carry this: live turns are added by the composer.
      if (update.content?.type === 'text')
        store.addEntry({
          id: `u-${Math.random().toString(36).slice(2)}`,
          role: 'user',
          text: update.content.text,
        });
      break;
    case 'agent_message_chunk':
      if (update.content?.type === 'text') store.appendChunk('agent', update.content.text);
      break;
    case 'agent_thought_chunk':
      if (update.content?.type === 'text') store.appendChunk('thought', update.content.text);
      break;
    case 'current_mode_update':
      store.setCurrentMode(update.currentModeId);
      break;
    case 'config_option_update':
      store.setConfigOptions(update.configOptions ?? []);
      break;
    case 'tool_call':
    case 'tool_call_update':
      store.upsertToolCall({
        toolCallId: update.toolCallId,
        title: update.title,
        status: update.status,
        kind: update.kind,
        content: update.content,
        locations: update.locations,
        rawInput: update.rawInput,
        rawOutput: update.rawOutput,
      });
      break;
    default:
      break;
  }
}
