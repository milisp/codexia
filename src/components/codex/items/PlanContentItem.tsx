import { save } from '@tauri-apps/plugin-dialog';
import { Check, ChevronDown, ChevronUp, Copy, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { isTauri } from '@/hooks/runtime';
import { writeFile } from '@/services';

type PlanContentItemProps = {
  text: string;
};

export const PlanContentItem = ({ text }: PlanContentItemProps) => {
  const [collapsed, setCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!text.length) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.error('Failed to copy plan text:', error);
    }
  };

  const handleDownload = async () => {
    if (!text.length || !isTauri()) return;

    try {
      const filePath = await save({
        defaultPath: 'plan.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!filePath) return;
      await writeFile(filePath, text);
    } catch (error) {
      console.error('Failed to save plan file:', error);
    }
  };

  if (!text.length) return null;

  return (
    <div>
      <div className="overflow-hidden rounded-md border bg-accent/40">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">Plan</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => void handleDownload()}
              disabled={!text.length || !isTauri()}
              aria-label="Download plan"
              title="Download plan.md"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => void handleCopy()}
              disabled={!text.length}
              aria-label={copied ? 'Copied' : 'Copy plan'}
              title={copied ? 'Copied' : 'Copy plan'}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? 'Expand plan content' : 'Collapse plan content'}
              title={collapsed ? 'Expand plan content' : 'Collapse plan content'}
            >
              {collapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        <div className={`overflow-hidden p-2 ${collapsed ? 'max-h-64' : 'max-h-[1200px]'}`}>
          <Markdown value={text} />
        </div>
      </div>
      {collapsed ? (
        <Button size="xs" onClick={() => setCollapsed(false)}>
          Expand plan
        </Button>
      ) : null}
    </div>
  );
};
