import initPrompt from '@/prompts/init.md?raw';
import { startReview } from '@/services';
import { codexService } from '@/services/codexService';

/** What a slash command can do once the composer text has been cleared. */
export interface SlashCommandContext {
  /** Thread the command runs against, started on demand. */
  ensureThread: () => Promise<string>;
  /** Current thread, or null when none is open yet. */
  currentThreadId: string | null;
  /** Opens one of the composer's command dialogs. */
  openDialog: (dialog: SlashDialog) => void;
}

export type SlashDialog = 'hooks' | 'memories' | 'import';

export interface SlashCommand {
  id: string;
  description: string;
  run: (ctx: SlashCommandContext) => Promise<void> | void;
}

/**
 * Commands available in the composer, ordered by expected frequency the way
 * codex-rs orders its own popup (see `tui/src/slash_command.rs`, which notes
 * the enum order is the presentation order). Only commands Codexia can
 * actually carry out are listed.
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'review',
    description: 'Review my current changes and find issues',
    run: async ({ ensureThread }) => {
      await startReview({
        threadId: await ensureThread(),
        target: { type: 'uncommittedChanges' },
        delivery: null,
      });
    },
  },
  {
    id: 'compact',
    description: 'Summarize conversation to prevent hitting the context limit',
    run: async ({ currentThreadId }) => {
      if (!currentThreadId) {
        return;
      }
      await codexService.threadCompact(currentThreadId);
    },
  },
  {
    id: 'init',
    description: 'Create an AGENTS.md file with instructions for Codex',
    run: async ({ ensureThread }) => {
      await codexService.turnStart(await ensureThread(), initPrompt);
    },
  },
  {
    id: 'memories',
    description: 'Configure memory use and generation',
    run: ({ openDialog }) => openDialog('memories'),
  },
  {
    id: 'hooks',
    description: 'View and manage lifecycle hooks',
    run: ({ openDialog }) => openDialog('hooks'),
  },
  {
    id: 'import',
    description: 'Import setup, this project, and recent chats from Claude Code',
    run: ({ openDialog }) => openDialog('import'),
  },
  {
    id: 'new',
    description: 'Start a new chat during a conversation',
    run: async () => {
      await codexService.setCurrentThread(null);
    },
  },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const needle = query.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) => cmd.id.startsWith(needle));
}
