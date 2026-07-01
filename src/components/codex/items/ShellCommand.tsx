import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { CheckCircle2, XCircle, AlertCircle, Loader2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCodexStore } from '@/components/codex/stores';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface ShellCommandProps {
  command: string;
  commandItemId: string | null | undefined;
  aggregatedOutput?: string | null;
}

type StatusConfig = {
  variant: 'default' | 'destructive' | 'outline' | 'secondary';
  icon: React.ComponentType<{ className?: string }>;
};

const STATUS_STYLE_MAP: Record<string, StatusConfig> = {
  completed: { variant: 'default', icon: CheckCircle2 },
  failed: { variant: 'destructive', icon: XCircle },
  declined: { variant: 'destructive', icon: AlertCircle },
  inProgress: { variant: 'secondary', icon: Loader2 },
};

const DEFAULT_STYLE: StatusConfig = { variant: 'secondary', icon: HelpCircle };

export const ShellCommand = ({ command, commandItemId, aggregatedOutput }: ShellCommandProps) => {
  const [copied, setCopied] = useState(false);
  const [outputCopied, setOutputCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async (
    e: React.MouseEvent,
    text: string,
    setCopyState: (v: boolean) => void
  ) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(true);
      setTimeout(() => setCopyState(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const { commandStatusMap } = useCodexStore();
  const status = commandItemId ? commandStatusMap[commandItemId] : undefined;
  const { variant, icon: Icon } = STATUS_STYLE_MAP[status ?? ''] ?? DEFAULT_STYLE;

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex gap-2 items-center text-sm font-mono text-muted-foreground hover:text-foreground transition-colors text-left w-full cursor-pointer"
      >
        <span className="shrink-0">Ran</span>

        <code className={`
      bg-muted/40 px-1.5 py-0.5 rounded border border-transparent group-hover:border-border
      min-w-0 
      ${isExpanded ? 'break-all whitespace-pre-wrap' : 'truncate'}
    `}>
          {command}
        </code>

        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-auto">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="rounded-md border bg-muted/30 font-mono text-sm overflow-hidden flex flex-col">
          <div className="border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground select-none">
            Shell
          </div>

          <div className="relative flex items-start justify-between gap-4 p-2 min-h-[3rem]">
            <code className="text-foreground flex-1 break-all whitespace-pre-wrap pt-1">
              $ {command}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={(e) => handleCopy(e, command, setCopied)}
              aria-label="Copy command"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {aggregatedOutput && (
            <div className="relative flex items-start justify-between gap-4 bg-muted/10 group/output">
              <div className="text-xs text-muted-foreground flex-1 break-all whitespace-pre-wrap pt-1 -ml-7 max-h-48 overflow-y-auto">
                {aggregatedOutput}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover/output:opacity-100 transition-opacity duration-150"
                onClick={(e) => handleCopy(e, aggregatedOutput, setOutputCopied)}
                aria-label="Copy output"
              >
                {outputCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          )}

          <div className="flex justify-end p-2">
            <Badge
              variant={variant}
              className="flex items-center gap-1.5 px-2.5 py-1 w-fit"
            >
              <Icon className={`h-3.5 w-3.5 ${status === 'inProgress' ? 'animate-spin' : ''}`} />
              <span>{t(status ?? '')}</span>
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
};