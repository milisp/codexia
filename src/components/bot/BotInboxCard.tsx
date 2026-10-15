import { Check, Copy, ExternalLink, FileText, Hand, Pencil, Send, X } from 'lucide-react';
import { useState } from 'react';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';
import type { BotInboxItem } from '@/services/apiAdapt/bots';
import { type InboxAction, resolveInboxItem } from './useBotInbox';

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
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { openExternalUrl } = useExternalUrl();
  const draft = item.kind === 'draft';
  const link = draft ? null : webLink(item.action);

  const act = async (action: InboxAction) => {
    setBusy(true);
    setError('');
    try {
      await resolveInboxItem(item, action, {
        body: draft && body !== item.body ? body : undefined,
        note: action === 'done' ? note : undefined,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (failure) {
      setError(String(failure));
    }
  };

  const Icon = draft ? FileText : Hand;
  return (
    <div className="space-y-2 rounded-lg border bg-background p-3 text-sm">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="font-medium break-words">{item.title}</div>
          <div className="text-xs text-muted-foreground">
            {draft
              ? item.action
                ? `On Send: ${item.action}`
                : 'Draft to copy'
              : 'Only you can do this step'}
          </div>
        </div>
        {draft && !editing && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Edit draft"
            title="Edit draft"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {draft && editing ? (
        <Textarea
          aria-label="Draft text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-32"
        />
      ) : draft ? (
        <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2">
          {body}
        </div>
      ) : (
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <Markdown value={item.body} />
        </div>
      )}

      {!draft && (
        <Input
          aria-label="Note for the bot"
          placeholder="Anything the bot should know (optional, no passwords)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {draft && item.action && (
          <Button size="sm" disabled={busy || !body.trim()} onClick={() => void act('send')}>
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        )}
        {draft && (
          <Button
            size="sm"
            variant={item.action ? 'outline' : 'default'}
            onClick={() => void copy()}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
        {link && (
          <Button
            size="sm"
            variant="outline"
            title={link}
            onClick={() => void openExternalUrl(link)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open link
          </Button>
        )}
        {!draft && (
          <Button size="sm" disabled={busy} onClick={() => void act('done')}>
            <Check className="h-3.5 w-3.5" />
            Done
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void act(draft ? 'discard' : 'dismiss')}
        >
          <X className="h-3.5 w-3.5" />
          {draft ? 'Discard' : 'Dismiss'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
