import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { codexService } from '@/services/codexService';
import {
  useComposerPopover,
  detectWordBoundaryTrigger,
  replaceAtTrigger,
  applyEditorReplacement,
} from '@/components/common/useComposerPopover';

const SLASH_COMMANDS = [{ id: 'review', description: 'Review uncommitted changes' }];
const detectSlash = detectWordBoundaryTrigger('/');
const filterCmd = (cmd: { id: string }, query: string) =>
  cmd.id.startsWith(query.toLowerCase());

interface SlashCommandPopoverProps {
  input: string;
  setInputValue: (v: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  triggerElement: HTMLElement | null;
  currentThreadId: string | null;
}

export function SlashCommandPopover({
  input,
  setInputValue,
  editorRef,
  triggerElement,
  currentThreadId,
}: SlashCommandPopoverProps) {
  const handleSelect = useCallback(
    async (cmd: { id: string; description: string }) => {
      // Remove the /command text from input
      const newValue = replaceAtTrigger(input, '/', '');
      const cleaned = (newValue ?? input).replace(/^\s+/, '').trimEnd();
      applyEditorReplacement(cleaned, setInputValue, editorRef);

      // Execute the command
      if (cmd.id === 'review') {
        let targetThreadId = currentThreadId;
        if (!targetThreadId) {
          try {
            const thread = await codexService.threadStart();
            targetThreadId = thread.id;
          } catch (error) {
            console.error('Failed to start thread for review:', error);
            return;
          }
        }
        try {
          await codexService.startReview({
            threadId: targetThreadId,
            target: { type: 'uncommittedChanges' },
            delivery: null,
          });
        } catch (error) {
          console.error('Failed to start review:', error);
        }
      }
    },
    [input, setInputValue, editorRef, currentThreadId],
  );

  const { open, filteredItems, selectedIndex, setSelectedIndex, itemRefs } =
    useComposerPopover({
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
      style={{
        position: 'fixed',
        top: rect?.top ?? 0,
        left: rect?.left ?? 0,
        transform: 'translateY(calc(-100% - 8px))',
      } as CSSProperties}
      className="z-[9999] w-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      <Command shouldFilter={false}>
        <CommandList>
          {filteredItems.length === 0 ? (
            <CommandEmpty>No commands found</CommandEmpty>
          ) : (
            <CommandGroup>
              {filteredItems.map((cmd, index) => (
                <CommandItem
                  key={cmd.id}
                  value={cmd.id}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  data-selected={index === selectedIndex}
                  className="flex flex-col items-start gap-0.5 data-[selected=true]:bg-accent"
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="font-medium text-sm">/{cmd.id}</div>
                  <div className="text-xs text-muted-foreground">{cmd.description}</div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground bg-muted/30">
        <span>↑↓ navigate</span>
        <span className="ml-3">↵ select</span>
        <span className="ml-3">Esc close</span>
      </div>
    </div>,
    document.body,
  );
}

// Keep old name exported for any remaining references
export { SlashCommandPopover as SlashCommandsSelector };
