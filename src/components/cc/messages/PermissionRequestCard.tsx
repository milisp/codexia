import { ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PermissionRequestMessage } from '../types/messages';
import type { PermissionDecision } from '../types/permission';
import { NO_RAW_INPUT_TOOLS } from '.';
import { ToolInputDisplay } from './ToolInputDisplay';
import {
  AskUserQuestionTool,
  BashTool,
  EditTool,
  GlobTool,
  GrepTool,
  ReadTool,
  TodoWriteTool,
  WriteTool,
} from './tool-use';

const RESOLVED_LABEL: Record<PermissionDecision, string> = {
  allow: 'Allowed Once',
  allow_always: 'Always Allowed (Session)',
  allow_project: 'Always Allowed (Project)',
  deny: 'Denied',
};

interface Props {
  msg: PermissionRequestMessage;
  onResolve: (id: string, decision: PermissionDecision) => void;
}

export function PermissionRequestCard({ msg, onResolve }: Props) {
  const resolved = msg.resolved;

  return (
    <Card className="p-4 border-amber-500/30 bg-amber-500/5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span className="text-sm font-semibold uppercase tracking-wide">Permission Request</span>
      </div>

      {/* Tool info */}
      <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-background/50 border border-amber-500/20 text-xs mb-3">
        {!NO_RAW_INPUT_TOOLS.includes(msg.toolName) && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">Tool:</span>
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-amber-600 dark:text-amber-400">
              {msg.toolName}
            </code>
          </div>
        )}
        {NO_RAW_INPUT_TOOLS.includes(msg.toolName) ? (
          (() => {
            const block = {
              type: 'tool_use',
              name: msg.toolName,
              input: msg.toolInput,
              id: msg.requestId,
            } as any;
            const errorProps = { inlineError: null, showError: false, onToggleError: () => {} };
            switch (msg.toolName) {
              case 'Read':
                return <ReadTool block={block} {...errorProps} />;
              case 'Edit':
                return <EditTool block={block} {...errorProps} />;
              case 'Write':
                return <WriteTool block={block} {...errorProps} />;
              case 'Bash':
                return <BashTool block={block} {...errorProps} />;
              case 'Glob':
                return <GlobTool block={block} {...errorProps} />;
              case 'Grep':
                return <GrepTool block={block} {...errorProps} />;
              case 'TodoWrite':
                return <TodoWriteTool block={block} {...errorProps} />;
              case 'AskUserQuestion':
                return <AskUserQuestionTool block={block} {...errorProps} />;
              default:
                return null;
            }
          })()
        ) : (
          <ToolInputDisplay
            input={msg.toolInput}
            highlightKeys={['file_path', 'path', 'command']}
          />
        )}
      </div>

      {/* Resolved state */}
      {resolved ? (
        <div
          className={cn(
            'text-[10px] font-bold px-2 py-1.5 rounded-md border text-center uppercase tracking-widest flex items-center justify-center gap-1.5',
            resolved === 'deny'
              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          )}
        >
          {resolved === 'deny' ? <X className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
          {RESOLVED_LABEL[resolved] ?? resolved}
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-red-500/30 text-red-500 hover:bg-red-500/5"
            onClick={() => onResolve(msg.requestId, 'deny')}
          >
            Deny
          </Button>
          {msg.alwaysAllowTarget === 'project' ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              onClick={() => onResolve(msg.requestId, 'allow_project')}
            >
              <ShieldCheck className="w-3 h-3 mr-1" /> Always Allow (project)
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={() => onResolve(msg.requestId, 'allow_always')}
            >
              <ShieldCheck className="w-3 h-3 mr-1" /> Always Allow (session)
            </Button>
          )}
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
            onClick={() => onResolve(msg.requestId, 'allow')}
          >
            Allow Once
          </Button>
        </div>
      )}
    </Card>
  );
}
