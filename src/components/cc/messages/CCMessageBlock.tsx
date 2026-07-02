import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Streamdown } from 'streamdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCCSettingsStore } from '@/stores/settings';
import type { ContentBlock, ToolResultBlock } from '../types/messages';
import { NO_RAW_INPUT_TOOLS } from '.';
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
import { safeStringify } from './utils';

const SILENT_RESULT_TOOLS = ['Read', 'Glob', 'Grep'];

interface Props {
  block: ContentBlock;
  index: number;
  toolName?: string;
  inlineError?: ToolResultBlock | null;
}

function stripErrorTags(s: string) {
  return s.replace(/^<tool_use_error>\s*/, '').replace(/\s*<\/tool_use_error>$/, '');
}

export function CCMessageBlock({ block, index, toolName, inlineError }: Props) {
  const blockKey = `block-${index}`;
  const [showError, setShowError] = useState(false);
  const [showWriteResult, setShowWriteResult] = useState(false);
  const { enabledThinking } = useCCSettingsStore();

  switch (block.type) {
    case 'text':
      return (
        <div key={blockKey} className="text-sm">
          <Streamdown>{block.text}</Streamdown>
        </div>
      );

    case 'thinking':
      if (!enabledThinking) return null;
      return (
        <div
          key={blockKey}
          className="rounded-md border-l-2 border-amber-400/50 pl-3 py-1 max-w-full overflow-hidden"
        >
          <div className="text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap break-words italic opacity-75">
            {block.thinking}
          </div>
        </div>
      );

    case 'tool_use': {
      const errorProps = { inlineError, showError, onToggleError: () => setShowError((p) => !p) };
      const toolComponent = (() => {
        switch (block.name) {
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
            return (
              <div>
                <Badge>{block.name}</Badge>
                <pre>{safeStringify(block.input)}</pre>
              </div>
            );
        }
      })();

      return (
        <div key={blockKey} className="overflow-auto">
          {toolComponent ?? (
            <>
              <div className="flex items-center flex-wrap gap-0.5">
                <Badge
                  variant="secondary"
                  className="text-[10px] h-4 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-none"
                >
                  {block.name}
                </Badge>
                {inlineError && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowError((p) => !p)}
                    className="h-4 w-4 text-red-500 hover:text-red-600"
                  >
                    {showError ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
              {!NO_RAW_INPUT_TOOLS.includes(block.name) && (
                <pre className="mt-2 text-xs overflow-auto bg-background/50 rounded-md p-3 max-h-60 break-all whitespace-pre-wrap font-mono">
                  <code>{JSON.stringify(block.input, null, 2)}</code>
                </pre>
              )}
              {inlineError && showError && (
                <div className="mt-1 text-xs whitespace-pre-wrap break-words text-red-600 dark:text-red-400 border-t border-red-500/20 pt-1">
                  {typeof inlineError.content === 'string'
                    ? stripErrorTags(inlineError.content)
                    : JSON.stringify(inlineError.content)}
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    case 'tool_result': {
      const isString = typeof block.content === 'string';
      const content = block.content;

      if (content == null || (isString && (content as string).trim().length === 0)) return null;
      if (
        (toolName && SILENT_RESULT_TOOLS.includes(toolName)) ||
        (!toolName && !block.is_error && isString && (content as string).length > 200)
      )
        return null;

      const isWriteTool = toolName === 'Write';
      const isLongText = isString && (content as string).length > 500;
      const displayContent = isString ? stripErrorTags(content as string) : content;

      return (
        <div
          key={blockKey}
          className={`rounded-lg border p-3 max-w-full overflow-hidden ${block.is_error ? 'border-red-500/20 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}
        >
          {isWriteTool && (
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWriteResult((p) => !p)}
                className="h-6 px-2 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
              >
                {showWriteResult ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {showWriteResult ? 'Hide' : 'Output'}
              </Button>
            </div>
          )}
          {(!isWriteTool || showWriteResult) &&
            (isString ? (
              <div
                className={`text-xs whitespace-pre-wrap break-words overflow-auto text-foreground/80 ${isLongText ? 'max-h-60' : ''}`}
              >
                {displayContent as string}
              </div>
            ) : (
              <pre className="text-xs overflow-auto max-h-60 break-all whitespace-pre-wrap font-mono bg-background/30 p-2 rounded">
                <code>{JSON.stringify(displayContent, null, 2)}</code>
              </pre>
            ))}
        </div>
      );
    }

    default:
      return (
        <div
          key={blockKey}
          className="rounded-lg border border-border bg-muted/30 p-3 max-w-full overflow-hidden"
        >
          <pre className="text-xs overflow-auto break-all whitespace-pre-wrap font-mono">
            <code>{JSON.stringify(block, null, 2)}</code>
          </pre>
        </div>
      );
  }
}
