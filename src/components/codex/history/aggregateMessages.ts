import type { RawMessage } from './type';

type ExecCommandRecord = {
  type: 'exec_command';
  begin: RawMessage | null;
  end: RawMessage | null;
};

export const aggregateMessages = (messages: RawMessage[]) => {
  const aggregated: RawMessage[] = [];
  const commandIndex = new Map<string, ExecCommandRecord>();
  const pendingOutputs = new Map<string, RawMessage>();
  const suppressedCallIds = new Set<string>();

  for (const msg of messages) {
    if (msg.type === 'update_plan' || msg.type === 'apply_patch') {
      const callId = msg.call_id;
      if (callId) {
        suppressedCallIds.add(callId);
        pendingOutputs.delete(callId);
      }
      aggregated.push(msg);
      continue;
    }

    if (msg.type === 'function_call') {
      const entry: ExecCommandRecord = {
        type: 'exec_command',
        begin: msg,
        end: null,
      };
      const callId = msg.call_id;
      if (callId) {
        const pending = pendingOutputs.get(callId);
        if (pending) {
          entry.end = pending;
          pendingOutputs.delete(callId);
        }
        commandIndex.set(callId, entry);
      }
      aggregated.push(entry);
      continue;
    }

    if (msg.type === 'function_call_output') {
      const callId = msg.call_id;
      if (callId) {
        if (suppressedCallIds.has(callId)) {
          continue;
        }
        const entry = commandIndex.get(callId);
        if (entry) {
          entry.end = msg;
          continue;
        }
        pendingOutputs.set(callId, msg);
        continue;
      }
      aggregated.push({ type: 'exec_command', begin: null, end: msg });
      continue;
    }

    aggregated.push(msg);
  }

  for (const output of pendingOutputs.values()) {
    aggregated.push({ type: 'exec_command', begin: null, end: output });
  }

  return aggregated;
};
