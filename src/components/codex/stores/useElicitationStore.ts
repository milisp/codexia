import { create } from 'zustand';
import type { RequestId } from '@/bindings';
import type {
  McpElicitationPrimitiveSchema,
  McpElicitationSchema,
  McpServerElicitationAction,
  McpServerElicitationRequestParams,
} from '@/bindings/v2';
import { respondToMcpElicitation } from '@/services';

/// Codex tags privileged approval elicitations through `_meta`; mirrors
/// codex-rs `protocol/src/mcp_approval_meta.rs`.
const APPROVAL_KIND_KEY = 'codex_approval_kind';
const APPROVAL_KIND_MCP_TOOL_CALL = 'mcp_tool_call';
const PERSIST_KEY = 'persist';
const PERSIST_SESSION = 'session';
const PERSIST_ALWAYS = 'always';

export type ElicitationRequest = McpServerElicitationRequestParams & {
  requestId: RequestId;
};

export type ElicitationChoice = {
  label: string;
  description?: string;
  action: McpServerElicitationAction;
  persist?: typeof PERSIST_SESSION | typeof PERSIST_ALWAYS;
};

export type ElicitationField = {
  id: string;
  label: string;
  description?: string;
  required: boolean;
  schema: McpElicitationPrimitiveSchema;
};

function metaObject(request: ElicitationRequest): Record<string, unknown> | null {
  if (request.mode === 'url') return null;
  const meta = request._meta;
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : null;
}

function supportsPersist(
  meta: Record<string, unknown> | null,
  mode: typeof PERSIST_SESSION | typeof PERSIST_ALWAYS
): boolean {
  const persist = meta?.[PERSIST_KEY];
  if (typeof persist === 'string') return persist === mode;
  return Array.isArray(persist) && persist.includes(mode);
}

function isMessageOnlySchema(schema: McpElicitationSchema | null): boolean {
  if (!schema) return true;
  return schema.type === 'object' && Object.keys(schema.properties ?? {}).length === 0;
}

/// A message-only schema means the server wants a decision, not form input —
/// the response carries the choice in `action` and leaves `content` null.
export function isApprovalElicitation(request: ElicitationRequest): boolean {
  if (request.mode !== 'form') return false;
  return isMessageOnlySchema(request.requestedSchema);
}

export function elicitationChoices(request: ElicitationRequest): ElicitationChoice[] {
  const meta = metaObject(request);
  const isToolCall = meta?.[APPROVAL_KIND_KEY] === APPROVAL_KIND_MCP_TOOL_CALL;

  const choices: ElicitationChoice[] = [
    {
      label: 'Allow',
      description: isToolCall ? 'Run the tool and continue.' : 'Allow this request and continue.',
      action: 'accept',
    },
  ];
  if (supportsPersist(meta, PERSIST_SESSION)) {
    choices.push({
      label: 'Allow for this session',
      description: 'Remember this choice for this session.',
      action: 'accept',
      persist: PERSIST_SESSION,
    });
  }
  if (supportsPersist(meta, PERSIST_ALWAYS)) {
    choices.push({
      label: 'Always allow',
      description: 'Remember this choice for future requests.',
      action: 'accept',
      persist: PERSIST_ALWAYS,
    });
  }
  if (!isToolCall) {
    choices.push({ label: 'Deny', description: 'Decline and continue.', action: 'decline' });
  }
  choices.push({ label: 'Cancel', description: 'Cancel this request.', action: 'cancel' });
  return choices;
}

export function elicitationFields(request: ElicitationRequest): ElicitationField[] {
  if (request.mode !== 'form' || isMessageOnlySchema(request.requestedSchema)) return [];
  const schema = request.requestedSchema;
  const required = schema.required ?? [];
  return Object.entries(schema.properties ?? {}).flatMap(([id, property]) => {
    if (!property) return [];
    const titled = property as { title?: string; description?: string };
    return [
      {
        id,
        label: titled.title || id,
        description: titled.description,
        required: required.includes(id),
        schema: property,
      },
    ];
  });
}

interface ElicitationStore {
  pendingRequests: ElicitationRequest[];
  addRequest: (request: ElicitationRequest) => void;
  respond: (
    requestId: RequestId,
    action: McpServerElicitationAction,
    content?: unknown,
    meta?: unknown
  ) => Promise<void>;
}

export const useElicitationStore = create<ElicitationStore>((set) => ({
  pendingRequests: [],
  addRequest: (request) => {
    set((state) => ({ pendingRequests: [...state.pendingRequests, request] }));
  },
  respond: async (requestId, action, content = null, meta = null) => {
    try {
      await respondToMcpElicitation(requestId, action, content, meta);
    } finally {
      // Drop it either way: a failed send leaves nothing the user can retry,
      // and a stuck card would block every later elicitation.
      set((state) => ({
        pendingRequests: state.pendingRequests.filter((r) => r.requestId !== requestId),
      }));
    }
  },
}));
