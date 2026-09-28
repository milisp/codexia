import { Check, Copy, ExternalLink, ImagePlus, Loader2, Rocket, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { SelectComponent } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';
import { fileSrc, isTauri } from '@/hooks/runtime';
import {
  type ConnectStart,
  type ProductshipAccount,
  publishConnectPoll,
  publishConnectStart,
  publishDisconnect,
  publishGame,
  publishWhoami,
} from '@/services';
import type { PublishDefaults } from './detectPublishDefaults';
import { DIMENSION_OPTIONS, GENRE_OPTIONS } from './gameTaxonomy';
import { usePublishProgress } from './usePublishProgress';
import { type PublishSettings, usePublishStore } from './usePublishStore';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const CONNECT_POLL_MS = 2000;
const CONNECT_TIMEOUT_MS = 10 * 60 * 1000;

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cwd: string;
  defaults: PublishDefaults;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const { openExternalUrl } = useExternalUrl();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-sm">{url}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Copy"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Open"
        onClick={() => void openExternalUrl(url)}
      >
        <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
}

function ConnectPanel({
  onConnected,
  needsUsername = false,
}: {
  onConnected: () => void;
  needsUsername?: boolean;
}) {
  const { openExternalUrl } = useExternalUrl();
  const [pending, setPending] = useState<ConnectStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const connect = async () => {
    setError(null);
    try {
      const start = await publishConnectStart();
      setPending(start);
      await openExternalUrl(start.url);
      const deadline = Date.now() + CONNECT_TIMEOUT_MS;
      while (!cancelledRef.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, CONNECT_POLL_MS));
        if (cancelledRef.current) return;
        const { approved } = await publishConnectPoll(start.code);
        if (approved) {
          onConnected();
          return;
        }
      }
      if (!cancelledRef.current) setError('Connect request expired. Try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setPending(null);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <Rocket className="size-10 text-orange-500" />
      <div>
        <p className="font-medium">
          {needsUsername ? 'Choose your username' : 'Connect your ProductShip account'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {needsUsername
            ? 'Games now live under your own name. Reconnect once to pick it.'
            : 'Games are hosted free with an itch-style page and cover:'}{' '}
          <span className="font-mono">username.productship.lol/game</span>
        </p>
      </div>
      {pending ? (
        <div className="flex w-full flex-col items-center gap-2 rounded-md border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Approve in your browser. Check that it shows this code:
          </p>
          <p className="font-mono text-2xl font-semibold tracking-widest">{pending.confirmCode}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Waiting for approval…
          </p>
          <Button variant="link" size="sm" onClick={() => void openExternalUrl(pending.url)}>
            Open the page again
          </Button>
        </div>
      ) : (
        <Button onClick={() => void connect()}>Connect ProductShip</Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function CoverPicker({
  cwd,
  coverPath,
  disabled,
  onChange,
}: {
  cwd: string;
  coverPath: string;
  disabled: boolean;
  onChange: (coverPath: string) => void;
}) {
  const pickCover = async () => {
    const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
    const picked = await openDialog({
      multiple: false,
      defaultPath: cwd,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (typeof picked === 'string') onChange(picked);
  };

  return (
    <div className="group relative aspect-video w-40 shrink-0">
      <button
        type="button"
        onClick={() => void pickCover()}
        disabled={!isTauri() || disabled}
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border bg-muted/40"
        title="Choose cover image"
      >
        {coverPath ? (
          <img src={fileSrc(coverPath)} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImagePlus className="size-5" />
            Cover
          </span>
        )}
      </button>
      {coverPath && !disabled && (
        <Button
          variant="ghost"
          size="icon"
          title="Remove cover"
          className="absolute right-1 top-1 h-5 w-5 bg-black/60 p-0.5 text-white opacity-0 hover:bg-black/80 group-hover:opacity-100"
          onClick={() => onChange('')}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}

interface PublishFormProps {
  cwd: string;
  account: ProductshipAccount;
  form: PublishSettings;
  setForm: (patch: Partial<PublishSettings>) => void;
  publishing: boolean;
  onDisconnect: () => void;
  onPublish: () => void;
  error: string | null;
}

function PublishForm({
  cwd,
  account,
  form,
  setForm: set,
  publishing,
  onDisconnect,
  onPublish,
  error,
}: PublishFormProps) {
  const lastPublish = usePublishStore((state) => state.lastPublish[cwd]);
  const progress = usePublishProgress(form.slug, publishing);
  const ownsSlug = account.games.some((game) => game.slug === form.slug);
  const username = account.user.username ?? '';
  // The game's own host is <slug>--<username>, and a DNS label is at most 63 chars.
  const maxSlugLength = Math.min(40, 61 - username.length);
  const slugValid =
    SLUG_RE.test(form.slug) && !form.slug.includes('--') && form.slug.length <= maxSlugLength;
  const canPublish = slugValid && form.title.trim().length > 0 && !publishing;

  let progressValue: number | undefined;
  if (progress?.stage === 'upload' && progress.total > 0) {
    progressValue = (progress.done / progress.total) * 100;
  } else if (progress?.stage === 'finalize') {
    progressValue = 100;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Publishing as <span className="font-mono">@{username}</span>
          {account.user.name && account.user.name !== username ? ` (${account.user.name})` : ''}
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          disabled={publishing}
          onClick={onDisconnect}
        >
          Disconnect
        </Button>
      </div>

      <div className="flex gap-3">
        <CoverPicker
          cwd={cwd}
          coverPath={form.coverPath}
          disabled={publishing}
          onChange={(coverPath) => set({ coverPath })}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="grid gap-1">
            <Label htmlFor="publish-title">Name</Label>
            <Input
              id="publish-title"
              value={form.title}
              maxLength={80}
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="publish-slug">Link</Label>
            <div className="flex items-center gap-1">
              <span className="max-w-[45%] shrink-0 truncate font-mono text-xs text-muted-foreground">
                {username}.productship.lol/
              </span>
              <Input
                id="publish-slug"
                value={form.slug}
                maxLength={maxSlugLength}
                className="font-mono"
                onChange={(event) => set({ slug: event.target.value.toLowerCase() })}
              />
            </div>
          </div>
        </div>
      </div>
      {!slugValid && (
        <p className="-mt-2 text-xs text-destructive">
          3-{maxSlugLength} chars: lowercase letters, digits and single dashes.
        </p>
      )}
      {ownsSlug && (
        <p className="-mt-2 text-xs text-muted-foreground">Updates your existing game.</p>
      )}

      <div className="grid gap-1">
        <Label htmlFor="publish-tagline">Tagline</Label>
        <Input
          id="publish-tagline"
          value={form.tagline}
          maxLength={140}
          placeholder="One line that makes people click Play"
          onChange={(event) => set({ tagline: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <div className="grid gap-1">
          <Label>Genre</Label>
          <SelectComponent
            value={form.genre}
            onValueChange={(genre) => set({ genre })}
            options={GENRE_OPTIONS}
            placeholder="Pick a genre"
            disabled={publishing}
          />
        </div>
        <div className="grid gap-1">
          <Label>Style</Label>
          <SelectComponent
            value={form.dimension}
            onValueChange={(dimension) => set({ dimension })}
            options={DIMENSION_OPTIONS}
            placeholder="2D / 3D"
            disabled={publishing}
          />
        </div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="publish-description">Description</Label>
        <Textarea
          id="publish-description"
          value={form.description}
          maxLength={5000}
          rows={3}
          placeholder="Controls, credits, what's new…"
          onChange={(event) => set({ description: event.target.value })}
        />
      </div>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <div className="grid gap-1">
          <Label htmlFor="publish-build">Build command</Label>
          <Input
            id="publish-build"
            value={form.buildCommand}
            className="font-mono"
            placeholder="none (already built)"
            onChange={(event) => set({ buildCommand: event.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="publish-output">Output folder</Label>
          <Input
            id="publish-output"
            value={form.outputDir}
            className="font-mono"
            onChange={(event) => set({ outputDir: event.target.value })}
          />
        </div>
      </div>

      {publishing && (
        <div className="flex flex-col gap-1.5">
          <Progress value={progressValue} />
          <p className="text-xs text-muted-foreground">{progress?.message ?? 'Starting…'}</p>
        </div>
      )}
      {error && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </pre>
      )}
      {!publishing && lastPublish && <LinkRow label="Current version" url={lastPublish.pageUrl} />}

      <DialogFooter>
        <Button
          className="gap-1.5 bg-orange-500 text-white hover:bg-orange-600"
          disabled={!canPublish}
          onClick={onPublish}
        >
          {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          {publishing ? 'Publishing…' : ownsSlug ? 'Publish update' : 'Publish'}
        </Button>
      </DialogFooter>
    </div>
  );
}

interface PublishPanelProps {
  cwd: string;
  defaults: PublishDefaults;
  publishing: boolean;
  setPublishing: (publishing: boolean) => void;
  onClose: () => void;
}

// Mounted fresh every time the dialog opens (Radix unmounts closed content), so
// its initial state always reflects the latest detection and saved values.
function PublishPanel({ cwd, defaults, publishing, setPublishing, onClose }: PublishPanelProps) {
  const saved = usePublishStore((state) => state.settings[cwd]);
  const lastPublish = usePublishStore((state) => state.lastPublish[cwd]);
  const updateSettings = usePublishStore((state) => state.updateSettings);
  const setLastPublish = usePublishStore((state) => state.setLastPublish);

  const [account, setAccount] = useState<ProductshipAccount | null | undefined>(undefined);
  const [form, setForm] = useState<PublishSettings>(() => ({ ...defaults, ...saved }));
  const [error, setError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);

  const loadAccount = useCallback(() => {
    setAccount(undefined);
    publishWhoami()
      .then(({ account }) => setAccount(account))
      .catch((err) => {
        setAccount(null);
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const submit = async () => {
    setError(null);
    setPublishing(true);
    updateSettings(cwd, form);
    try {
      const result = await publishGame({
        cwd,
        slug: form.slug,
        title: form.title.trim(),
        tagline: form.tagline.trim() || null,
        description: form.description.trim() || null,
        genre: form.genre || null,
        dimension: form.dimension || null,
        buildCommand: form.buildCommand.trim() || null,
        outputDir: form.outputDir.trim() || '.',
        coverPath: form.coverPath || null,
      });
      setLastPublish(cwd, { ...result, publishedAt: new Date().toISOString() });
      setJustPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  };

  if (account === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (account === null) return <ConnectPanel onConnected={loadAccount} />;
  // Connected before usernames existed: reconnect once to claim one.
  if (!account.user.username) return <ConnectPanel onConnected={loadAccount} needsUsername />;

  if (justPublished && lastPublish) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          🎉 Live! Version {lastPublish.version} · {lastPublish.fileCount} files ·{' '}
          {formatBytes(lastPublish.totalBytes)}
        </p>
        <LinkRow label="Game" url={lastPublish.playUrl} />
        <LinkRow label="Project page" url={lastPublish.pageUrl} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setJustPublished(false)}>
            Edit details
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <PublishForm
      cwd={cwd}
      account={account}
      form={form}
      setForm={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      publishing={publishing}
      onDisconnect={() => void publishDisconnect().then(() => setAccount(null))}
      onPublish={() => void submit()}
      error={error}
    />
  );
}

export function PublishDialog({ open, onOpenChange, cwd, defaults }: PublishDialogProps) {
  const [publishing, setPublishing] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => !publishing && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-orange-500" /> Publish game
          </DialogTitle>
          <DialogDescription>
            Build this project and host it on productship.lol. You get a shareable game link and an
            itch-style project page.
          </DialogDescription>
        </DialogHeader>
        <PublishPanel
          cwd={cwd}
          defaults={defaults}
          publishing={publishing}
          setPublishing={setPublishing}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
