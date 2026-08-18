import { Check, Copy, ExternalLink, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import recommendData from '@/assets/recommend.json';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';

interface Tool {
  name: string;
  description: string;
  url: string;
  setup?: string;
  badge?: string;
}

const REMOTE_RECOMMEND_URL =
  'https://raw.githubusercontent.com/milisp/codexia/main/src/assets/recommend.json';

function SetupPopover({ setup }: { setup: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(setup);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Show setup command">
          <Terminal className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground">Setup command</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void handleCopy()}>
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <pre className="p-3 text-[11px] font-mono text-foreground whitespace-pre-wrap break-all leading-relaxed">
          {setup}
        </pre>
      </PopoverContent>
    </Popover>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const { openExternalUrl } = useExternalUrl();

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-accent/30 transition-colors">
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={() => void openExternalUrl(tool.url)}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-sm font-medium truncate">{tool.name}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          {tool.badge && (
            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {tool.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </button>
      {tool.setup && <SetupPopover setup={tool.setup} />}
    </div>
  );
}

export function RecommendToolsView() {
  const [tools, setTools] = useState<Tool[]>((recommendData as { tools: Tool[] }).tools);

  useEffect(() => {
    let cancelled = false;

    // `cache: 'no-cache'` lets the browser revalidate with the server
    // (using its own ETag/Last-Modified) instead of always re-downloading.
    fetch(REMOTE_RECOMMEND_URL, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tools: Tool[] } | null) => {
        if (!cancelled && data?.tools) {
          setTools(data.tools);
        }
      })
      .catch(() => {
        // ignore network errors, keep bundled data
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 p-4">
      {tools.map((tool) => (
        <ToolCard key={tool.name} tool={tool} />
      ))}
    </div>
  );
}
