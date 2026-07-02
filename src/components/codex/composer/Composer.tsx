import { convertFileSrc } from '@tauri-apps/api/core';
import { ArrowUp, Square, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useThreadStatus } from '@/components/codex/hooks';
import { useCodexStore } from '@/components/codex/stores';
import { ContextWindowWidget } from '@/components/codex/widget';
import { FileMentionPopover } from '@/components/common';
import { Button } from '@/components/ui/button';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore } from '@/stores';
import { useInputStore } from '@/stores/useInputStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AccessModePopover } from './AccessModePopover';
import { AttachmentSelector } from './AttachmentSelector';
import { ComposerToolbarProvider } from './ComposerToolbarContext';
import { ModelReasonSelector } from './ModelReasonSelector';
import { SkillsInputPopover } from './SkillsPopover';
import { SlashCommandPopover } from './SlashCommandsSelector';

interface ComposerProps {
  overrideSend?: (text: string) => void;
  onAfterSend?: (threadId: string, text: string) => void;
}

export function Composer({ overrideSend, onAfterSend }: ComposerProps) {
  const [images, setImages] = useState<string[]>([]);
  const { inputValue, setInputValue, appendFileLinks } = useInputStore();
  const { currentThreadId, currentTurnId, inputFocusTrigger } = useCodexStore();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();
  const { cwd } = useWorkspaceStore.getState();
  const threadStatus = useThreadStatus();

  const isComposing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentThreadId, inputFocusTrigger]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing.current) {
      e.preventDefault();
      textareaRef.current?.form?.requestSubmit();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text && images.length === 0) {
      return;
    }

    // If thread is active and we have a turnId, steer the existing turn.
    if (threadStatus?.type === 'active' && currentThreadId && currentTurnId) {
      try {
        await codexService.turnSteer(currentThreadId, currentTurnId, text, images);
        setInputValue('');
        setImages([]);
      } catch (error) {
        console.error(error);
      }
      return;
    }

    if (overrideSend) {
      overrideSend(text);
      setInputValue('');
      return;
    }

    let targetThreadId = currentThreadId;
    let worktreePath: string | undefined;

    if (!targetThreadId) {
      try {
        const thread = await codexService.threadStart();
        targetThreadId = thread.id;
        worktreePath = thread.cwd?.includes('/.codexia/worktrees/') ? thread.cwd : undefined;
      } catch (error) {
        console.error(error);
        return;
      }
    }

    addAgentCard({ kind: 'codex', id: targetThreadId, preview: text, worktreePath, cwd });
    setCurrentAgentCardId(targetThreadId);
    onAfterSend?.(targetThreadId, text);
    setInputValue('');

    try {
      await codexService.turnStart(targetThreadId, text, images);
      setImages([]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleStop = async () => {
    if (currentThreadId && currentTurnId) {
      await codexService.turnInterrupt(currentThreadId, currentTurnId);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="pb-[env(safe-area-inset-bottom)] bg-background">
        <FileMentionPopover
          input={inputValue}
          setInput={setInputValue}
          editorRef={textareaRef}
          triggerElement={wrapperRef.current}
        />
        <SlashCommandPopover
          input={inputValue}
          setInputValue={setInputValue}
          editorRef={textareaRef}
          triggerElement={wrapperRef.current}
        />
        <SkillsInputPopover
          input={inputValue}
          setInputValue={setInputValue}
          editorRef={textareaRef}
          triggerElement={wrapperRef.current}
        />

        <div className="max-w-3xl mx-2 sm:mx-auto border rounded-xl bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden">
          {images.length > 0 && (
            <div className="flex gap-2 p-3 pb-0 overflow-x-auto">
              {images.map((path, index) => (
                <div key={path} className="relative group shrink-0">
                  <img
                    src={convertFileSrc(path)}
                    alt="attachment"
                    className="h-16 w-16 object-cover rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div ref={wrapperRef} className="max-h-64 overflow-y-auto px-3 pt-3">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => {
                isComposing.current = true;
              }}
              onCompositionEnd={() => {
                isComposing.current = false;
              }}
              placeholder="Do anything... / $ @"
              className="w-full min-h-[44px] resize-none bg-transparent text-base md:text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center justify-between px-1 bg-muted/20 border-t">
            <ComposerToolbarProvider className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <AttachmentSelector
                  onImagesSelected={(paths) => setImages((prev) => [...prev, ...paths])}
                  onFilesSelected={appendFileLinks}
                />
                <AccessModePopover />
              </div>
              <div className="flex items-center gap-2">
                <ContextWindowWidget />
                <ModelReasonSelector />
                {threadStatus?.type === 'active' ? (
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    size="icon"
                    className="h-10 w-10 md:h-8 md:w-8 rounded-full"
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!inputValue.trim() && images.length === 0}
                    size="icon"
                    className="h-10 w-10 md:h-8 md:w-8 rounded-full"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </ComposerToolbarProvider>
          </div>
        </div>
      </form>
    </div>
  );
}
