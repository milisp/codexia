import { ShieldCheck } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';
import { ccAcceptConsent, ccGetConsent } from '@/services';

const BILLING_DOC_URL = 'https://github.com/milisp/codexia#claude-agent-usage-and-billing';

type ConsentState = 'loading' | 'required' | 'accepted';

interface CCUsageConsentProps {
  children: ReactNode;
}

/**
 * Blocks the Claude composer until the user acknowledges how Claude Agent usage is billed.
 * The answer lives in ~/.codexia/cc-consent.json on the backend, so every client agrees.
 */
export function CCUsageConsent({ children }: CCUsageConsentProps) {
  const [state, setState] = useState<ConsentState>('loading');
  const [saving, setSaving] = useState(false);
  const { openExternalUrl } = useExternalUrl();

  useEffect(() => {
    let cancelled = false;
    ccGetConsent()
      .then((status) => {
        if (!cancelled) setState(status.accepted ? 'accepted' : 'required');
      })
      .catch(() => {
        if (!cancelled) setState('required');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAccept = async () => {
    setSaving(true);
    try {
      const status = await ccAcceptConsent();
      setState(status.accepted ? 'accepted' : 'required');
    } catch (error) {
      console.error('[CCUsageConsent] Failed to save consent:', error);
    } finally {
      setSaving(false);
    }
  };

  if (state === 'accepted') return <>{children}</>;
  if (state === 'loading') return null;

  return (
    <div className="shrink-0 rounded-md border border-input p-3 text-sm space-y-2">
      <div className="flex items-center gap-2 font-medium">
        <ShieldCheck className="h-4 w-4" />
        Before you use Claude Agent
      </div>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
        <li>
          Codexia runs your own local Claude CLI through the Claude Agent SDK. It never signs in to
          claude.ai for you.
        </li>
        <li>
          If your CLI is signed in with a Claude subscription, usage here is programmatic and counts
          against your plan's monthly Agent SDK credit, billed at API rates, not your regular
          interactive limits.
        </li>
        <li>With an API key, usage is billed to your Anthropic Console account.</li>
        <li>Codexia is an independent project and is not affiliated with Anthropic.</li>
      </ul>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => void openExternalUrl(BILLING_DOC_URL)}>
          Learn more
        </Button>
        <Button size="sm" onClick={handleAccept} disabled={saving}>
          I understand
        </Button>
      </div>
    </div>
  );
}
