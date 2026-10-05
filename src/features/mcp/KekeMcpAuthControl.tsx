import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { useKekeMcpAuth } from './useKekeMcpAuth';

export function KekeMcpAuthControl({
  name,
  auth,
  disabled,
}: {
  name: string;
  auth: ReturnType<typeof useKekeMcpAuth>;
  disabled?: boolean;
}) {
  const pending = auth.pending === name;
  const signedIn = auth.statuses[name]?.signedIn;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || auth.pending !== null}
        aria-label={`${signedIn ? 'Reauthorize' : 'Sign in to'} ${name}`}
        onClick={() => auth.authorize(name)}
      >
        {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
        {pending ? 'Authorizing…' : signedIn ? 'Reauthorize' : 'Sign in'}
      </Button>
      {pending && (
        <p className="text-xs text-muted-foreground">
          Complete authorization in your desktop browser.
        </p>
      )}
      {auth.errors[name] && (
        <p role="alert" className="max-w-64 break-words text-xs text-destructive">
          {auth.errors[name]}
        </p>
      )}
    </div>
  );
}
