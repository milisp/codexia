import { fireEvent, render, screen } from '@testing-library/react';
import { useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@/lib/i18n';
import type { ServerNotification } from '@/bindings';
import type { ThreadItem } from '@/bindings/v2';
import { deriveRenderItems } from '../thread/deriveRenderItems';
import { EventItem } from './EventItem';
import { ThreadStepChain } from './ThreadStepChain';

vi.mock('@/components/Markdown', () => ({
  Markdown: ({ value }: { value: string }) => <div>{value}</div>,
}));

vi.mock('@/hooks/use-highlighted-code', () => ({
  useHighlightedCode: (value: string) => value.split('\n'),
}));

const completed = (item: Record<string, unknown>): ServerNotification =>
  ({
    method: 'item/completed',
    params: { item, threadId: 't1', turnId: 'turn1', completedAtMs: 0 },
  }) as unknown as ServerNotification;

const started = (item: Record<string, unknown>): ServerNotification =>
  ({
    method: 'item/started',
    params: { item, threadId: 't1', turnId: 'turn1', startedAtMs: 0 },
  }) as unknown as ServerNotification;

const command = (overrides: Record<string, unknown> = {}): ThreadItem =>
  ({
    type: 'commandExecution',
    id: 'cmd1',
    command: 'bun test',
    cwd: '/tmp',
    status: 'completed',
    commandActions: [],
    aggregatedOutput: 'all green',
    exitCode: 0,
    durationMs: 3000,
    ...overrides,
  }) as unknown as ThreadItem;

// Renders the chains CodexThread builds from raw events.
function Chains({ events }: { events: ServerNotification[] }) {
  const items = useMemo(() => deriveRenderItems(events), [events]);
  return (
    <>
      {items.map((item) =>
        item.kind === 'chain' ? <ThreadStepChain key={item.key} steps={item.steps} /> : null
      )}
    </>
  );
}

describe('EventItem steps', () => {
  it('renders reasoning collapsed under a Thinking line', () => {
    render(
      <EventItem
        event={completed({
          type: 'reasoning',
          id: 'r1',
          summary: ['Weighing options'],
          content: [],
        })}
      />
    );
    const trigger = screen.getByRole('button', { name: /Thinking/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Weighing options')).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByText('Weighing options')).toBeTruthy();
  });

  it('shows a started reasoning item as running', () => {
    const { container } = render(
      <EventItem event={started({ type: 'reasoning', id: 'r1', summary: [], content: [] })} />
    );
    expect(container.querySelector('[data-status="running"]')).not.toBeNull();
  });

  it('renders a command as a terminal row with exit code and output', () => {
    render(<EventItem event={completed(command({ exitCode: 2 }))} />);
    fireEvent.click(screen.getByRole('button', { name: /bun test exited with code 2/ }));
    expect(screen.getByText(/all green/)).toBeTruthy();
  });

  it('renders a successful command title and duration', () => {
    render(<EventItem event={completed(command())} />);
    expect(screen.getByText('Ran bun test')).toBeTruthy();
    expect(screen.getByText('0:03')).toBeTruthy();
  });

  it('does not render item/started when the item already completed', () => {
    const start = started(command());
    const done = completed(command());
    const { container } = render(
      <EventItem event={start} context={{ events: [start, done], eventIndex: 0 }} />
    );
    expect(container.textContent).toBe('');
  });

  it('renders mcp tool call details on expand', () => {
    render(
      <EventItem
        event={completed({
          type: 'mcpToolCall',
          id: 'm1',
          server: 'github',
          tool: 'search',
          status: 'completed',
          arguments: {},
          result: { content: [], structuredContent: { hits: 3 }, _meta: null },
          error: null,
          durationMs: 1000,
        })}
      />
    );
    expect(screen.getByText('github · 0:01')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Called search/ }));
    expect(screen.getByText(/"hits": 3/)).toBeTruthy();
  });

  it('renders web search, context compaction, hook prompt and sleep lines', () => {
    render(
      <>
        <EventItem
          event={completed({
            type: 'webSearch',
            id: 'w1',
            query: 'tauri',
            action: null,
            results: null,
          })}
        />
        <EventItem event={completed({ type: 'contextCompaction', id: 'c1' })} />
        <EventItem
          event={completed({
            type: 'hookPrompt',
            id: 'h1',
            fragments: [{ text: 'check lint', hookRunId: 'x' }],
          })}
        />
        <EventItem event={completed({ type: 'sleep', id: 's1', durationMs: 5000 })} />
      </>
    );
    expect(screen.getByText('Searched the web: tauri')).toBeTruthy();
    expect(screen.getByText('Context compacted')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Hook prompt/ })).toBeTruthy();
    expect(screen.getByText('Slept for 0:05')).toBeTruthy();
  });

  it('renders a sub-agent call with its prompt', () => {
    render(
      <EventItem
        event={completed({
          type: 'collabAgentToolCall',
          id: 'a1',
          tool: 'spawnAgent',
          status: 'completed',
          senderThreadId: 's',
          receiverThreadIds: ['thread-abcdefgh12345678'],
          prompt: 'Investigate flaky test',
          model: null,
          reasoningEffort: null,
          agentsStates: {},
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Spawned sub-agent/ }));
    expect(screen.getByText('Investigate flaky test')).toBeTruthy();
  });

  it('renders the turn plan with progress', () => {
    render(
      <EventItem
        event={
          {
            method: 'turn/plan/updated',
            params: {
              threadId: 't1',
              turnId: 'turn1',
              explanation: null,
              plan: [
                { step: 'Write tests', status: 'completed' },
                { step: 'Ship it', status: 'pending' },
              ],
            },
          } as unknown as ServerNotification
        }
      />
    );
    expect(screen.getByText('1 of 2 done')).toBeTruthy();
    expect(screen.getByText('Write tests')).toBeTruthy();
    expect(screen.getByText('Ship it')).toBeTruthy();
  });

  it('renders nothing for unknown item types', () => {
    const { container } = render(
      <EventItem event={completed({ type: 'somethingNew', id: 'n1' })} />
    );
    expect(container.textContent).toBe('');
  });
});

describe('thread step chain', () => {
  it('groups consecutive steps and expands on demand', () => {
    render(
      <Chains
        events={[
          started({ type: 'reasoning', id: 'r1', summary: [], content: [] }),
          completed({ type: 'reasoning', id: 'r1', summary: ['plan'], content: [] }),
          completed(command()),
        ]}
      />
    );
    expect(screen.queryByText('Ran bun test')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Worked in 2 steps/ }));
    expect(screen.getByText('Ran bun test')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Thinking/ })).toBeTruthy();
  });

  it('keeps an in-flight chain open and running', () => {
    render(
      <Chains
        events={[
          completed(command()),
          started(
            command({
              id: 'cmd2',
              command: 'bun lint',
              status: 'inProgress',
              aggregatedOutput: null,
            })
          ),
        ]}
      />
    );
    expect(screen.getByText('Running bun lint')).toBeTruthy();
    expect(screen.getByText('Ran bun test')).toBeTruthy();
  });

  it('does not treat a started step of a finished turn as running', () => {
    const { container } = render(
      <Chains
        events={[
          started({ type: 'reasoning', id: 'r1', summary: [], content: [] }),
          {
            method: 'turn/completed',
            params: { threadId: 't1', turn: { id: 'turn1', items: [], status: 'interrupted' } },
          } as unknown as ServerNotification,
        ]}
      />
    );
    expect(container.querySelector('[data-status="running"]')).toBeNull();
  });
});
