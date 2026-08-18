import { HooksDialog } from './dialogs/HooksDialog';
import { ImportDialog } from './dialogs/ImportDialog';
import { MemoriesDialog } from './dialogs/MemoriesDialog';
import type { SlashDialog } from './slashCommands';

interface SlashCommandDialogsProps {
  open: SlashDialog | null;
  onClose: () => void;
}

/**
 * Host for the dialogs opened by slash commands (`/hooks`, `/memories`,
 * `/import`). Each dialog owns its own data loading and is mounted only while
 * selected.
 */
export function SlashCommandDialogs({ open, onClose }: SlashCommandDialogsProps) {
  if (!open) {
    return null;
  }
  if (open === 'hooks') {
    return <HooksDialog open onClose={onClose} />;
  }
  if (open === 'memories') {
    return <MemoriesDialog open onClose={onClose} />;
  }
  if (open === 'import') {
    return <ImportDialog open onClose={onClose} />;
  }
  return null;
}
