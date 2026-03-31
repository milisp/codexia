import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { codexService } from '@/services/codexService';
import type { SkillsListEntry } from '@/bindings/v2/SkillsListEntry';
import { Switch } from '@/components/ui/switch';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { detectWordBoundaryTrigger, replaceAtTrigger, applyEditorReplacement } from '@/components/common/useComposerPopover';

type SkillWithEnabled = SkillsListEntry['skills'][number] & { enabled?: boolean };

const detectDollar = detectWordBoundaryTrigger('$');

interface SkillsInputPopoverProps {
  input: string;
  setInputValue: (v: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  triggerElement: HTMLElement | null;
}

export function SkillsInputPopover({
  input,
  setInputValue,
  editorRef,
  triggerElement,
}: SkillsInputPopoverProps) {
  const { cwd } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const [skillsList, setSkillsList] = useState<SkillsListEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect `$` trigger
  useEffect(() => {
    const { open: shouldOpen } = detectDollar(input);
    setOpen(shouldOpen);
  }, [input]);

  useEffect(() => {
    if (!open) return;
    codexService.listSkills(cwd).then(setSkillsList).catch(console.error);
  }, [open, cwd]);

  const handleClose = useCallback(() => {
    const newValue = replaceAtTrigger(input, '$', '');
    const cleaned = (newValue ?? input).replace(/^\s+/, '').trimEnd();
    applyEditorReplacement(cleaned, setInputValue, editorRef);
    setOpen(false);
  }, [input, setInputValue, editorRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); handleClose(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, handleClose]);

  if (!open || typeof document === 'undefined') return null;

  const rect = triggerElement?.getBoundingClientRect();

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: rect?.top ?? 0,
        left: rect?.left ?? 0,
        transform: 'translateY(calc(-100% - 8px))',
      } as CSSProperties}
      className="z-[9999] w-96 max-w-[600px] max-h-96 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md p-3"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Skills</span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-4">
        <h4 className="font-medium leading-none mb-2 text-sm text-muted-foreground">
          Available Skills
        </h4>
        {skillsList.flatMap((e) => e.skills).length === 0 ? (
          <div className="text-sm text-muted-foreground p-2">No skills found.</div>
        ) : (
          <div className="grid gap-2">
            {skillsList
              .flatMap((entry) => entry.skills)
              .map((skill, i) => {
                const typedSkill = skill as SkillWithEnabled;
                return (
                  <div
                    key={`${skill.name}-${i}`}
                    className="flex justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <span className="flex gap-2">
                      <div className="font-medium text-sm">{skill.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {skill.shortDescription || skill.description}
                      </div>
                    </span>
                    <span className="flex gap-2">
                      <div className="text-xs text-muted-foreground">{skill.scope}</div>
                      <Switch
                        checked={typedSkill.enabled ?? false}
                        onCheckedChange={(checked) => {
                          codexService.skillsConfigWrite(skill.path, checked).catch(console.error);
                          setSkillsList((prev) =>
                            prev.map((entry) => {
                              if (entry.skills.some((s) => s.path === skill.path)) {
                                return {
                                  ...entry,
                                  skills: entry.skills.map((s) =>
                                    s.path === skill.path
                                      ? ({ ...s, enabled: checked } as SkillWithEnabled)
                                      : s
                                  ),
                                };
                              }
                              return entry;
                            })
                          );
                        }}
                      />
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
