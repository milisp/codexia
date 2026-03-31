import { useEffect, useRef, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useCCStore } from '@/stores/cc';
import { ccGetSlashCommands } from '@/services';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import {
  useComposerPopover,
  detectWordBoundaryTrigger,
  replaceAtTrigger,
  applyEditorReplacement,
} from '@/components/common/useComposerPopover';

interface CCSlashCommandPopoverProps {
  input: string;
  setInput: (v: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  triggerElement: HTMLElement | null;
}

const detectSlash = detectWordBoundaryTrigger('/');
const filterCmd = (cmd: string, query: string) =>
  !query || cmd.toLowerCase().includes(query.toLowerCase());

export function CCSlashCommandPopover({
  input,
  setInput,
  editorRef,
  triggerElement,
}: CCSlashCommandPopoverProps) {
  const slashCommands = useCCStore((s) => s.slashCommands);
  const setSlashCommands = useCCStore((s) => s.setSlashCommands);
  const cwd = useWorkspaceStore((s) => s.cwd);

  useEffect(() => {
    if (slashCommands.length > 0) return;
    ccGetSlashCommands(cwd || undefined)
      .then(setSlashCommands)
      .catch((err) => console.error('[CCSlashCommandPopover] Failed to load slash commands:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback(
    (cmd: string) => {
      const newValue = replaceAtTrigger(input, '/', `/${cmd}`);
      if (newValue !== null) applyEditorReplacement(newValue, setInput, editorRef);
      else editorRef.current?.focus();
    },
    [input, setInput, editorRef],
  );

  const { open, setOpen, filteredItems, selectedIndex, setSelectedIndex, itemRefs } =
    useComposerPopover({
      input,
      items: slashCommands,
      filter: filterCmd,
      detect: detectSlash,
      onKeySelect: handleSelect,
    });

  const triggerRef = useRef<HTMLSpanElement | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <span
          ref={(el) => {
            triggerRef.current = el;
            if (el && triggerElement) {
              const rect = triggerElement.getBoundingClientRect();
              el.style.position = 'fixed';
              el.style.left = `${rect.left}px`;
              el.style.top = `${rect.top}px`;
              el.style.width = '0';
              el.style.height = '0';
              el.style.pointerEvents = 'none';
            }
          }}
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-56 p-1 max-h-60 overflow-hidden flex flex-col shadow-xl z-50"
        sideOffset={4}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto flex-1 py-1">
          {filteredItems.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">No matches</div>
          ) : (
            filteredItems.map((cmd, index) => (
              <Button
                key={cmd}
                ref={(el) => { itemRefs.current[index] = el; }}
                variant={index === selectedIndex ? 'secondary' : 'ghost'}
                className="w-full justify-start text-xs h-7 font-mono rounded-none"
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                /{cmd}
              </Button>
            ))
          )}
        </div>
        <div className="border-t px-3 py-1.5 bg-muted/30 flex items-center gap-3 text-xs text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
