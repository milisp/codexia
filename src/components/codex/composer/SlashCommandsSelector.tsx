import type { CSSProperties } from 'react';
import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCodexStore } from '@/components/codex/stores';
import type { ComposerEditorRef } from '@/components/common/useComposerPopover';
import {
  applyEditorReplacement,
  detectWordBoundaryTrigger,
  replaceAtTrigger,
  useComposerPopover,
} from '@/components/common/useComposerPopover';
import { codexService } from '@/services/codexService';
import { SLASH_COMMANDS, type SlashCommand, type SlashDialog } from './slashCommands';

const detectSlash = detectWordBoundaryTrigger('/');
const filterCmd = (cmd: SlashCommand, query: string) => cmd.id.startsWith(query.toLowerCase());

interface SlashCommandPopoverProps {
  input: string;
  setInputValue: (v: string) => void;
  editorRef: ComposerEditorRef;
  triggerElement: HTMLElement | null;
  onOpenDialog: (dialog: SlashDialog) => void;
}

export function SlashCommandPopover({
  input,
  setInputValue,
  editorRef,
  triggerElement,
  onOpenDialog,
}: SlashCommandPopoverProps) {
  const { currentThreadId } = useCodexStore();

  const handleSelect = useCallback(
    async (cmd: SlashCommand) => {
      // Drop the /command text before running it.
      const newValue = replaceAtTrigger(input, '/', '');
      const cleaned = (newValue ?? input).replace(/^\s+/, '').trimEnd();
      applyEditorReplacement(cleaned, setInputValue, editorRef);

      try {
        await cmd.run({
          currentThreadId,
          openDialog: onOpenDialog,
          ensureThread: async () => {
            if (currentThreadId) {
              return currentThreadId;
            }
            const thread = await codexService.threadStart();
            return thread.id;
          },
        });
      } catch (error) {
        console.error(`Failed to run /${cmd.id}:`, error);
      }
    },
    [input, setInputValue, editorRef, currentThreadId, onOpenDialog]
  );

  const { open, filteredItems, selectedIndex, setSelectedIndex, itemRefs } = useComposerPopover({
    input,
    items: SLASH_COMMANDS,
    filter: filterCmd,
    detect: detectSlash,
    onKeySelect: handleSelect,
  });

  if (!open || typeof document === 'undefined' || filteredItems.length === 0) return null;

  const rect = triggerElement?.getBoundingClientRect();

  return createPortal(
    <div
      style={
        {
          position: 'fixed',
          top: rect?.top ?? 0,
          left: rect?.left ?? 0,
          transform: 'translateY(calc(-100% - 8px))',
        } as CSSProperties
      }
      className="z-[9999] w-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {/* Plain buttons rather than cmdk: CommandItem owns its own `data-selected`
          and swallows clicks, which left this list unable to highlight or select. */}
      <div className="max-h-72 overflow-y-auto p-1">
        {filteredItems.map((cmd, index) => (
          <button
            key={cmd.id}
            type="button"
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            data-selected={index === selectedIndex}
            className="flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left data-[selected=true]:bg-accent"
            onMouseEnter={() => setSelectedIndex(index)}
            // Keep the editor focused so the command can replace the composer text.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleSelect(cmd)}
          >
            <div className="font-medium text-sm">/{cmd.id}</div>
            <div className="text-xs text-muted-foreground">{cmd.description}</div>
          </button>
        ))}
      </div>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground bg-muted/30">
        <span>↑↓ navigate</span>
        <span className="ml-3">↵ select</span>
        <span className="ml-3">Esc close</span>
      </div>
    </div>,
    document.body
  );
}

// Keep old name exported for any remaining references
export { SlashCommandPopover as SlashCommandsSelector };
