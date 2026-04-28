import { useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, Square, X } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { SlashCommandPopover, SkillsInputPopover } from './selector';
import { FileMentionPopover } from '@/components/common';
import { useInputStore } from '@/stores/useInputStore';
import { useCodexStore } from '@/stores/codex';
import { useIsProcessing } from '@/hooks/codex';

interface InputAreaProps {
  onSend: (message: string) => Promise<void>;
  onStop: () => Promise<void>;
  images?: string[];
  onRemoveImage?: (index: number) => void;
}

export function InputArea({
  onSend,
  onStop,
  children,
  images = [],
  onRemoveImage,
}: InputAreaProps & { children?: React.ReactNode }) {
  const { currentThreadId, inputFocusTrigger } = useCodexStore();
  const isProcessing = useIsProcessing();
  const { inputValue, setInputValue } = useInputStore();

  const isComposing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const handleSendRef = useRef<() => Promise<void>>(async () => { });

  // Focus the textarea when thread changes or triggered externally
  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentThreadId, inputFocusTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea height to fit content
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [inputValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (isComposing.current || (e.nativeEvent as KeyboardEvent & { isComposing?: boolean }).isComposing) {
          return;
        }
        e.preventDefault();
        handleSendRef.current();
      }
    },
    [],
  );

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text && images.length === 0) return;
    if (isProcessing) return;

    setInputValue('');

    try {
      await onSend(text);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };
  handleSendRef.current = handleSend;

  const handleStop = async () => {
    try {
      await onStop();
    } catch (error) {
      console.error('Failed to stop turn:', error);
    }
  };

  return (
    <div className="pb-[env(safe-area-inset-bottom)] bg-background">
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
        currentThreadId={currentThreadId}
      />

      <SkillsInputPopover
        input={inputValue}
        setInputValue={setInputValue}
        editorRef={textareaRef}
        triggerElement={wrapperRef.current}
      />

      <div className="max-w-3xl mx-2 sm:mx-auto relative border rounded-xl bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all">
        {/* Image attachments */}
        {images.length > 0 && (
          <div className="flex gap-2 p-3 pb-0 overflow-x-auto">
            {images.map((path, index) => (
              <div key={index} className="relative group shrink-0">
                <img
                  src={convertFileSrc(path)}
                  alt="attachment"
                  className="h-16 w-16 object-cover rounded-md border"
                />
                <button
                  onClick={() => onRemoveImage?.(index)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea input */}
        <div ref={wrapperRef} className="max-h-64 overflow-y-auto px-3 pt-3">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={() => { setTimeout(() => { isComposing.current = false; }, 50); }}
            placeholder="Ask anything... @file /command $skills"
            rows={1}
            className="w-full resize-none bg-transparent text-base md:text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between rounded-b-xl bg-muted/20">
          <div className="flex items-center">{children}</div>
          <div>
            {isProcessing ? (
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
                onClick={handleSend}
                disabled={!inputValue.trim() && images.length === 0}
                size="icon"
                className="h-10 w-10 md:h-8 md:w-8 rounded-full"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
