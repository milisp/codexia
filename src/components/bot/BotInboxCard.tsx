import { Check, Copy, ExternalLink, FileText, Hand, Pencil, Send, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';
import type { BotInboxItem } from '@/services/apiAdapt/bots';
import { type InboxAction, resolveInboxItem } from './useBotInbox';

type Act = (action: InboxAction, extra?: { body?: string; note?: string }) => void;

/** Only plain web links are offered as a button; anything else stays text. */
function webLink(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * A draft the bot wrote instead of sending, or a step it handed back. Nothing
 * is sent until you press Send; Send and Done continue the conversation the
 * item came from.
 */
export function BotInboxCard({ item }: { item: BotInboxItem }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act: Act = async (action, extra = {}) => {
    setBusy(true);
    setError('');
    try {
      await resolveInboxItem(item, action, extra);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border bg-background p-3 text-sm">
      {item.kind === 'draft' ? (
        <DraftBody item={item} busy={busy} act={act} onError={setError} />
      ) : (
        <HandBackBody item={item} busy={busy} act={act} />
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function CardHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="font-medium break-words">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

function DraftBody({
  item,
  busy,
  act,
  onError,
}: {
  item: BotInboxItem;
  busy: boolean;
  act: Act;
  onError: (message: string) => void;
}) {
  // `null` until edited: the text shown is the bot's until you change it.
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const body = edited ?? item.body;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (failure) {
      onError(String(failure));
    }
  };

  return (
    <>
      <CardHeader
        icon={<FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        title={item.title}
        subtitle={item.action ? `On Send: ${item.action}` : 'Draft to copy'}
        action={
          edited === null && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label="Edit draft"
              title="Edit draft"
              onClick={() => setEdited(item.body)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )
        }
      />
      {edited === null ? (
        <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2">
          {body}
        </div>
      ) : (
        <Textarea
          aria-label="Draft text"
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          className="min-h-32"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {item.action && (
          <Button
            size="sm"
            disabled={busy || !body.trim()}
            onClick={() => act('send', { body: body !== item.body ? body : undefined })}
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        )}
        <Button size="sm" variant={item.action ? 'outline' : 'default'} onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => act('discard')}>
          <X className="h-3.5 w-3.5" />
          Discard
        </Button>
      </div>
    </>
  );
}

function HandBackBody({ item, busy, act }: { item: BotInboxItem; busy: boolean; act: Act }) {
  const [note, setNote] = useState('');
  const { openExternalUrl } = useExternalUrl();
  const link = webLink(item.action);

  return (
    <>
      <CardHeader
        icon={<Hand className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        title={item.title}
        subtitle="Only you can do this step"
      />
      <div className="rounded-md bg-muted/50 px-3 py-2">
        <Markdown value={item.body} />
      </div>
      <Input
        aria-label="Note for the bot"
        placeholder="Anything the bot should know (optional, no passwords)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {link && (
          <Button size="sm" variant="outline" title={link} onClick={() => openExternalUrl(link)}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open link
          </Button>
        )}
        <Button size="sm" disabled={busy} onClick={() => act('done', { note })}>
          <Check className="h-3.5 w-3.5" />
          Done
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => act('dismiss')}>
          <X className="h-3.5 w-3.5" />
          Dismiss
        </Button>
      </div>
    </>
  );
}
