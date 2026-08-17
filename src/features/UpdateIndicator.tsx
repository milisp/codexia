import { Check, Download, Loader2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUpdater } from '@/hooks/useUpdater';

const BREW_UPGRADE = 'brew upgrade --cask codexia';

/**
 * Takes over an existing icon slot (the sidebar's issue link) only while an
 * update is pending, so the UI stays quiet the rest of the time. The download
 * runs in the background; the click just installs and relaunches. On a Homebrew
 * install brew owns the bundle, so the click copies the brew command instead.
 */
export function UpdateIndicator({ fallback }: { fallback: ReactNode }) {
  const { state, startUpdate } = useUpdater({ enabled: !import.meta.env.DEV });
  const [copied, setCopied] = useState(false);

  const { stage, version, error, downloaded, contentLength } = state;
  if (stage === 'idle' || stage === 'checking') {
    return <>{fallback}</>;
  }

  if (stage === 'homebrew') {
    return (
      <IconButton
        title={`Update ${version} available — click to copy \`${BREW_UPGRADE}\``}
        onClick={() => {
          void navigator.clipboard.writeText(BREW_UPGRADE);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      </IconButton>
    );
  }

  const percent =
    contentLength && contentLength > 0
      ? Math.min(100, Math.round(((downloaded ?? 0) / contentLength) * 100))
      : undefined;
  const busy = stage === 'downloading' || stage === 'installing' || stage === 'restarting';
  const title =
    stage === 'error'
      ? `Update failed — click to retry (${error})`
      : stage === 'downloading'
        ? `Downloading update ${version}${percent === undefined ? '' : ` — ${percent}%`}`
        : stage === 'installing'
          ? 'Installing update'
          : stage === 'restarting'
            ? 'Restarting'
            : `Update ${version} ready — click to install and restart`;

  return (
    <IconButton
      title={title}
      disabled={stage === 'installing' || stage === 'restarting'}
      onClick={() => void startUpdate()}
      className={stage === 'ready' ? 'text-primary' : undefined}
    >
      {stage === 'downloading' && percent !== undefined ? (
        <ProgressRing percent={percent} />
      ) : busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </IconButton>
  );
}

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Download progress as a ring, sized to sit in the same slot as the icons. */
function ProgressRing({ percent }: { percent: number }) {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 -rotate-90" aria-hidden>
      <circle
        cx="9"
        cy="9"
        r={RADIUS}
        fill="none"
        strokeWidth="2"
        className="stroke-muted-foreground/30"
      />
      <circle
        cx="9"
        cy="9"
        r={RADIUS}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-primary transition-[stroke-dashoffset]"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
      />
    </svg>
  );
}

function IconButton({ children, className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="icon" className={`h-6 w-6 ${className ?? ''}`} {...props}>
      {children}
    </Button>
  );
}
