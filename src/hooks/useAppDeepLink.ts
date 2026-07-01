import { useDeepLink } from '@/hooks/useDeepLink';
import { navigateToAgentSession } from '@/lib/agentNav';

// Parses and routes incoming deep links, e.g.
// codexia://open?agent=codex&thread=<id>&cwd=<path>
// codexia://open?agent=cc&session=<id>&cwd=<path>
function handleDeepLinkUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.warn('[deep-link] Failed to parse URL:', url);
    return;
  }

  const params = parsed.searchParams;
  const navigated = navigateToAgentSession({
    agent: params.get('agent'),
    cwd: params.get('cwd'),
    threadId: params.get('thread'),
    sessionId: params.get('session'),
  });

  if (!navigated) {
    console.warn('[deep-link] Missing or unsupported params:', url);
  }
}

// App-level entry point: wires the generic deep link listener to app routing logic.
export const useAppDeepLink = () => {
  useDeepLink(handleDeepLinkUrl);
};
