import {
  FileOutputIcon,
  GlobeIcon,
  ImageIcon,
  ShrinkIcon,
  TimerIcon,
  WebhookIcon,
  WrenchIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CodeOutput } from '@/components/ai-elements/CodeOutput';
import { Reasoning } from '@/components/ai-elements/Reasoning';
import { Subagent } from '@/components/ai-elements/Subagent';
import { Terminal } from '@/components/ai-elements/Terminal';
import { Tool } from '@/components/ai-elements/Tool';
import { getFilename } from '@/utils/getFilename';
import {
  CollabAgentToolCallItem,
  type CollabAgentToolCallItemData,
} from './CollabAgentToolCallItem';
import { displayCommand, formatStepDuration, isStepFailed, type StepItem } from './stepItems';

interface ThreadStepItemProps {
  item: StepItem;
  /** True while the step is still in flight (started, not yet completed). */
  running?: boolean;
}

const toJson = (value: unknown) => JSON.stringify(value, null, 2);

const shortId = (id: string) => (id.length > 8 ? `…${id.slice(-8)}` : id);

function outputText(output: Extract<StepItem, { type: 'functionCallOutput' }>['output']): string {
  if (typeof output === 'string') return output;
  return output
    .map((part) => (part.type === 'input_text' ? part.text : `[${part.type}]`))
    .join('\n');
}

/** Renders one transcript step with the matching AI Elements pattern. */
export function ThreadStepItem({ item, running = false }: ThreadStepItemProps) {
  const { t } = useTranslation('thread');
  const failed = isStepFailed(item);
  const status = running ? 'running' : failed ? 'error' : undefined;

  switch (item.type) {
    case 'reasoning':
      return (
        <Reasoning
          title={t('items.thinking')}
          text={[...item.summary, ...item.content].join('\n\n')}
          running={running}
        />
      );
    case 'commandExecution': {
      const command = displayCommand(item);
      let title: string;
      if (running) {
        title = t('items.runningCommand', { command });
      } else if (item.status === 'declined') {
        title = t('items.commandDeclined', { command });
      } else if (item.exitCode !== null && item.exitCode !== 0) {
        title = t('items.commandExited', { command, code: item.exitCode });
      } else if (item.status === 'failed') {
        title = t('items.commandFailed', { command });
      } else {
        title = t('items.ranCommand', { command });
      }
      return (
        <Terminal
          command={command}
          title={title}
          description={
            !running && typeof item.durationMs === 'number' && item.durationMs > 0
              ? formatStepDuration(item.durationMs)
              : undefined
          }
          status={status}
          output={item.aggregatedOutput}
        />
      );
    }
    case 'mcpToolCall': {
      const hasDetails = !!item.result || !!item.error;
      const duration =
        !running && typeof item.durationMs === 'number' && item.durationMs > 0
          ? formatStepDuration(item.durationMs)
          : undefined;
      return (
        <Tool
          icon={<WrenchIcon />}
          title={
            running
              ? t('items.callingTool', { tool: item.tool })
              : failed
                ? t('items.toolFailed', { tool: item.tool })
                : t('items.calledTool', { tool: item.tool })
          }
          description={[item.server, duration].filter(Boolean).join(' · ')}
          status={status}
        >
          {hasDetails ? (
            <>
              {item.error && (
                <CodeOutput code={item.error.message} language="text" variant="destructive" />
              )}
              {item.result && (
                <CodeOutput
                  code={toJson(item.result.structuredContent ?? item.result.content)}
                  language="json"
                />
              )}
            </>
          ) : null}
        </Tool>
      );
    }
    case 'dynamicToolCall': {
      const name = item.namespace ? `${item.namespace}.${item.tool}` : item.tool;
      const text = (item.contentItems ?? [])
        .map((part) => (part.type === 'inputText' ? part.text : `[${part.type}]`))
        .join('\n');
      const args = toJson(item.arguments);
      const hasArgs = args !== '{}' && args !== 'null';
      return (
        <Tool
          icon={<WrenchIcon />}
          title={
            running
              ? t('items.callingTool', { tool: name })
              : failed
                ? t('items.toolFailed', { tool: name })
                : t('items.calledTool', { tool: name })
          }
          description={
            !running && typeof item.durationMs === 'number' && item.durationMs > 0
              ? formatStepDuration(item.durationMs)
              : undefined
          }
          status={status}
        >
          {text || hasArgs ? (
            <>
              {hasArgs && <CodeOutput code={args} language="json" />}
              {text && <CodeOutput code={text} language="text" />}
            </>
          ) : null}
        </Tool>
      );
    }
    case 'webSearch':
      return (
        <Tool
          icon={<GlobeIcon />}
          title={
            running
              ? t('items.searchingWeb', { query: item.query })
              : t('items.webSearch', { query: item.query })
          }
          status={status}
        />
      );
    case 'imageView':
      return (
        <Tool
          icon={<ImageIcon />}
          title={t('items.viewedImage')}
          description={getFilename(item.path)}
          status={status}
        />
      );
    case 'imageGeneration':
      return (
        <Tool
          icon={<ImageIcon />}
          title={
            running
              ? t('items.generatingImage')
              : failed
                ? t('items.imageFailed')
                : t('items.generatedImage')
          }
          description={item.savedPath ? getFilename(item.savedPath) : undefined}
          status={status}
        >
          {item.revisedPrompt ? <p>{item.revisedPrompt}</p> : null}
        </Tool>
      );
    case 'contextCompaction':
      return (
        <Tool
          icon={<ShrinkIcon />}
          title={running ? t('items.compactingContext') : t('items.contextCompacted')}
          status={status}
        />
      );
    case 'functionCallOutput': {
      const text = outputText(item.output);
      return (
        <Tool icon={<FileOutputIcon />} title={t('items.toolOutput', { name: item.name })}>
          {text ? <CodeOutput code={text} language="text" /> : null}
        </Tool>
      );
    }
    case 'hookPrompt': {
      const text = item.fragments.map((fragment) => fragment.text).join('\n\n');
      return (
        <Tool icon={<WebhookIcon />} title={t('items.hookPrompt')}>
          {text ? <p className="whitespace-pre-wrap">{text}</p> : null}
        </Tool>
      );
    }
    case 'sleep': {
      const duration = formatStepDuration(item.durationMs);
      return (
        <Tool
          icon={<TimerIcon />}
          title={running ? t('items.sleeping', { duration }) : t('items.slept', { duration })}
          status={status}
        />
      );
    }
    case 'collabAgentToolCall':
      return <CollabAgentToolCallItem item={item as unknown as CollabAgentToolCallItemData} />;
    case 'subAgentActivity': {
      const titleKey = {
        started: 'items.subAgentStarted',
        interacted: 'items.subAgentInteracted',
        interrupted: 'items.subAgentInterrupted',
        completed: 'items.subAgentCompleted',
      } as const;
      return (
        <Subagent
          title={t(titleKey[item.kind])}
          description={shortId(item.agentThreadId)}
          state={item.kind === 'interrupted' ? 'error' : 'done'}
        >
          {item.agentPath || item.model ? (
            <p className="font-mono text-xs">
              {[item.agentPath, item.model, item.reasoningEffort].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </Subagent>
      );
    }
    default:
      return null;
  }
}
