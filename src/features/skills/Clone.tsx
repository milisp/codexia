import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { cloneSkillsRepo } from '@/services';

const RECOMMENDED_URLS = [
  'https://github.com/anthropics/skills.git',
  'https://github.com/openai/skills.git',
];

export function Clone() {
  const [url, setUrl] = useState(RECOMMENDED_URLS[0]);
  const [cloningUrl, setCloningUrl] = useState<string | null>(null);
  const [clonedTargets, setClonedTargets] = useState<Array<{ url: string; path: string }>>([]);

  const handleClone = async (rawUrl: string) => {
    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl || cloningUrl) {
      if (!trimmedUrl) {
        toast.error('Please enter a repository URL.');
      }
      return;
    }

    setCloningUrl(trimmedUrl);
    try {
      const path = await cloneSkillsRepo(trimmedUrl);
      setClonedTargets((prev) => {
        const next = prev.filter((item) => item.url !== trimmedUrl);
        return [...next, { url: trimmedUrl, path }];
      });
      toast.success('Repository cloned successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Clone failed';
      toast.error('Failed to clone repository', {
        description: message,
      });
    } finally {
      setCloningUrl(null);
    }
  };

  const handleCloneCustom = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast.error('Please enter a repository URL.');
      return;
    }

    await handleClone(trimmedUrl);
  };

  return (
    <div>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold">Skills Repository</h2>
        <p className="text-sm text-muted-foreground">
          Clone a repository into{' '}
          <code>
            ~/.agents/plugins/{'{user}'}/{'{repo}'}
          </code>
          .
        </p>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/anthropics/skills.git"
          />
          <Button onClick={handleCloneCustom} disabled={Boolean(cloningUrl)}>
            {cloningUrl === url.trim() ? 'Cloning...' : 'Clone'}
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Recommended</p>
          <div className="space-y-2">
            {RECOMMENDED_URLS.map((recommendedUrl) => (
              <div
                key={recommendedUrl}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <a
                  href={recommendedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-primary underline"
                >
                  {recommendedUrl}
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClone(recommendedUrl)}
                  disabled={Boolean(cloningUrl)}
                >
                  {cloningUrl === recommendedUrl ? 'Cloning...' : 'Clone'}
                </Button>
              </div>
            ))}
          </div>
        </div>
        {clonedTargets.length > 0 ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            {clonedTargets.map((item) => (
              <p key={item.url}>
                <span>Cloned </span>
                <code>{item.url}</code>
                <span> to </span>
                <code>{item.path}</code>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
