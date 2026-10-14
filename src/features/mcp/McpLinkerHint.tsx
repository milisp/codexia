import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useExternalUrl } from '@/features/plugins/hooks/useExternalUrl';

const BREW_INSTALL = 'brew install mcplinker';
const MCP_LINKER_URL = 'https://mcp-linker.milisp.dev/?ref=codexia';

/** One quiet line pointing to MCP Linker for syncing connectors to other apps. */
export function McpLinkerHint() {
  const { openExternalUrl } = useExternalUrl();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(BREW_INSTALL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-4 text-xs text-muted-foreground">
      <span>
        Use these connectors in Claude Desktop, Cursor and more with{' '}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-2 hover:underline"
          onClick={() => void openExternalUrl(MCP_LINKER_URL)}
        >
          MCP Linker
        </button>
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-6 gap-1.5 px-2 font-mono text-[11px]"
        title="Copy install command"
        onClick={() => void copy()}
      >
        {BREW_INSTALL}
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}
