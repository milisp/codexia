import { useEffect, useRef, useState, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ccGetInstalledSkills } from '@/services';
import {
  useComposerPopover,
  detectWordBoundaryTrigger,
  replaceAtTrigger,
  applyEditorReplacement,
} from '@/components/common/useComposerPopover';

interface CCSkillsPopoverProps {
  input: string;
  setInput: (v: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  triggerElement: HTMLElement | null;
}

const detectDollar = detectWordBoundaryTrigger('$');
const filterSkill = (skill: string, query: string) =>
  !query || skill.toLowerCase().includes(query.toLowerCase());

export function CCSkillsPopover({
  input,
  setInput,
  editorRef,
  triggerElement,
}: CCSkillsPopoverProps) {
  const [installedSkills, setInstalledSkills] = useState<string[]>([]);
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    ccGetInstalledSkills()
      .then(setInstalledSkills)
      .catch((err) => console.error('Failed to load skills:', err));
  }, []);

  const handleSelect = useCallback(
    (skill: string) => {
      // Skills are invoked with `/skillname` by Claude Code CLI
      const newValue = replaceAtTrigger(input, '$', `/${skill}`);
      if (newValue !== null) applyEditorReplacement(newValue, setInput, editorRef);
      else editorRef.current?.focus();
    },
    [input, setInput, editorRef],
  );

  const { open, setOpen, filteredItems, selectedIndex, setSelectedIndex, itemRefs } =
    useComposerPopover({
      input,
      items: installedSkills,
      filter: filterSkill,
      detect: detectDollar,
      onKeySelect: handleSelect,
    });

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
            <div className="text-xs text-muted-foreground text-center py-2">
              {installedSkills.length === 0 ? 'No skills installed' : 'No matches'}
            </div>
          ) : (
            filteredItems.map((skill, index) => (
              <Button
                key={skill}
                ref={(el) => { itemRefs.current[index] = el; }}
                variant={index === selectedIndex ? 'secondary' : 'ghost'}
                className="w-full justify-start text-xs h-7 font-mono rounded-none"
                onClick={() => handleSelect(skill)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                /{skill}
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
