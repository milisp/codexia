import { useEffect, useState, useMemo } from 'react';
import { Dot, Funnel } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DiffViewer } from '@/components/features/DiffViewer';
import { AccordionMsg } from '@/components/codex/history/AccordionMsg';
import HistoryExecCommandItem from './HistoryExecCommandItem';
import { HistoryPatchOutputIcon } from './HistoryPatchOutputIcon';
import { useCurrentThread } from '@/components/codex/stores/useCodexStore';
import { RawMessage } from './type';
import { aggregateMessages } from './aggregateMessages';
import { PlanDisplay, SimplePlanStep } from './PlanDisplay';
import { HistoryFilters, createInitialFilterState } from './HistoryFilters';
import { Markdown } from '@/components/Markdown';
import { readTextFileLines } from '@/services';
import { Streamdown } from 'streamdown';

export function History() {
  const currentThread = useCurrentThread();
  const currentPath = useMemo(() => currentThread?.path ?? '', [currentThread]);
  const [msgs, setMsgs] = useState<RawMessage[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [expandedExecCommands, setExpandedExecCommands] = useState<Record<string, boolean>>({});
  const [messageTypes, setMessageTypes] = useState(createInitialFilterState);

  useEffect(() => {
    let isMounted = true;
    setMsgs([]);
    setExpandedExecCommands({});
    if (!currentPath) {
      return () => {
        isMounted = false;
      };
    }

    const readConversation = async () => {
      try {
        const lines = await readTextFileLines(currentPath);
        let messages: RawMessage[] = [];
        let payload: Record<string, any> = {};
        for await (const line of lines) {
          if (!line) continue;
          const cleanedLine = line.replace(/\0/g, '');
          if (!cleanedLine.trim()) continue;
          const parsed = JSON.parse(cleanedLine);
          if (!parsed) continue;
          switch (parsed.type) {
            case 'session_meta':
              // console.log(parsed);
              break;
            case 'event_msg':
              payload = parsed.payload;
              if (payload.type !== 'token_count') {
                messages.push(payload);
              }
              break;
            case 'response_item':
              payload = parsed.payload;
              if (!['message', 'reasoning', 'ghost_snapshot'].includes(payload.type)) {
                if (
                  ![
                    'function_call',
                    'function_call_output',
                    'custom_tool_call',
                    'custom_tool_call_output',
                  ].includes(payload.type)
                ) {
                  console.log(payload);
                }
                if (payload.type === 'function_call') {
                  if (payload.name === 'update_plan') {
                    payload.type = 'update_plan';
                  } else if (payload.name === 'apply_patch') {
                    payload.type = 'apply_patch';
                  }
                }

                messages.push(payload);
              }
              break;
            default:
              payload = parsed.payload;
              if (parsed.type !== 'turn_context') {
                console.log(payload);
              }
              break;
          }
        }
        if (!isMounted) return;
        setMsgs(aggregateMessages(messages));
      } catch (error) {
        console.error('Failed to read history conversation:', error);
        if (isMounted) {
          setMsgs([]);
        }
      }
    };

    readConversation();

    return () => {
      isMounted = false;
    };
  }, [currentPath]);

  const filteredMessages = useMemo(
    () =>
      msgs.filter((msg) => {
        const type = msg.type ?? '';
        return messageTypes[type] ?? true;
      }),
    [messageTypes, msgs]
  );

  const toggleExecCommand = (id: string) => {
    setExpandedExecCommands((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleFilterChange = (type: string, checked: boolean) => {
    setMessageTypes((prev) => ({
      ...prev,
      [type]: checked,
    }));
  };

  if (!currentPath) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4 text-sm text-muted-foreground">
        Select a conversation to view its history.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-end px-2 py-1 shrink-0">
        <Popover open={showFilter} onOpenChange={setShowFilter}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost">
              <Funnel className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-4">
            <HistoryFilters messageTypes={messageTypes} onFilterChange={handleFilterChange} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col p-4 gap-2 overflow-auto flex-1">
        {filteredMessages.map((msg, index) => {
          switch (msg.type) {
            case 'agent_message':
              return (
                <div className="flex w-full" key={`agent-${index}`}>
                  <Markdown value={msg.message} />
                </div>
              );
            case 'user_message':
              return (
                <div key={`user-${index}`} className="p-3 rounded-lg max-w-[90%] self-end shadow-md">
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.images.map((image: string, index: number) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Uploaded ${index + 1}`}
                          className="max-w-full max-h-48 rounded object-contain"
                        />
                      ))}
                    </div>
                  )}
                  <Streamdown>{msg.message}</Streamdown>
                </div>
              );

            case 'agent_reasoning_raw_content':
            case 'agent_reasoning': {
              if (!msg.text.includes('\n')) {
                return (
                  <span className="flex items-center gap-2" key={index}>
                    <Dot size={8} />
                    <Markdown value={msg.text} />
                  </span>
                );
              }
              const firstNewlineIndex = msg.text.indexOf('\n');
              const title = msg.text.substring(0, firstNewlineIndex);
              const content = msg.text.substring(firstNewlineIndex + 1);
              return (
                <span className="flex items-center" key={index}>
                  <Dot size={8} />
                  <AccordionMsg title={title} content={content} />
                </span>
              );
            }
            case 'turn_aborted':
              return (
                <Badge key={index} className="bg-red-200 dark:bg-red-500">
                  {msg.reason}
                </Badge>
              );
            case 'exec_command': {
              const begin = msg.begin ?? null;
              const end = msg.end ?? null;
              const callId = begin?.call_id ?? end?.call_id ?? `exec-${index}`;
              const isOpen = expandedExecCommands[callId] ?? false;
              return (
                <HistoryExecCommandItem
                  key={`${callId}-${index}`}
                  begin={begin}
                  end={end}
                  isOpen={isOpen}
                  onToggle={() => toggleExecCommand(callId)}
                />
              );
            }
            case 'update_plan':
              let planArgs: { plan: SimplePlanStep[]; explanation: string } = JSON.parse(
                msg.arguments
              );
              return <PlanDisplay key={index} steps={planArgs.plan} />;
            case 'apply_patch':
              let applyPatchArgs = JSON.parse(msg.arguments);
              return (
                <div key={index}>
                  <DiffViewer unifiedDiff={applyPatchArgs.input} />
                </div>
              );
            case 'custom_tool_call':
              return (
                <div key={index}>
                  <DiffViewer unifiedDiff={msg.input} />
                </div>
              );
            case 'custom_tool_call_output':
              return (
                <div key={index}>
                  <HistoryPatchOutputIcon patch_output={msg.output} />
                </div>
              );
            case 'ghost_snapshot':
            case 'task_started':
            case 'task_complete':
              return null;
            default:
              return <code key={index}>{JSON.stringify(msg)}</code>;
          }
        })}
      </div>
    </div>
  );
}
