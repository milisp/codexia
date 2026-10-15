/**
 * What a bot's standing "always allow" is about. Prefers the key the backend
 * computed (keke's tool id), then the ACP kind, then the title. ACP's `other`
 * is never a key: every MCP tool has it, so approving it would approve them all.
 * Mirrors `approval_key` in `crates/acp/src/client.rs`.
 */
export function approvalKey(request: {
  approvalKey?: string;
  kind?: string;
  title?: string;
}): string | undefined {
  if (request.approvalKey) return request.approvalKey;
  if (request.kind && request.kind !== 'other') return request.kind;
  return request.title;
}

/** The short name a person reads on the button: `lookup_price`, not `acp:shop:lookup_price`. */
export function approvalLabel(key: string): string {
  return /^[^\s:]+(:[^\s:]+)+$/.test(key) ? key.slice(key.lastIndexOf(':') + 1) : key;
}
