import { ArrowUp, Circle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { parseDraft, searchQueryFromDraft } from './draft';

type TodoInputBarProps = {
  onSubmit: (text: string, categoryName: string | null) => void;
  onAddCategory: (name: string) => void;
  onSearchChange: (value: string) => void;
};

export function TodoInputBar({ onSubmit, onAddCategory, onSearchChange }: TodoInputBarProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const reset = () => {
    setDraft('');
    onSearchChange('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const submit = () => {
    if (!draft.trim()) return;
    const { text, categoryName } = parseDraft(draft);
    // `# some name` on its own creates the category instead of a todo.
    if (!text) {
      if (categoryName) onAddCategory(categoryName);
      reset();
      return;
    }
    onSubmit(text, categoryName);
    reset();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      textareaRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const canSubmit = draft.trim().length > 0;

  return (
    <div className="group relative m-2 flex flex-col gap-2 rounded-2xl border bg-background/80 p-2 shadow-lg backdrop-blur-xl transition-all duration-200 focus-within:shadow-xl">
      <div className="flex items-start gap-2.5 px-1 pt-0.5">
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
          <Circle className="size-4 stroke-[1.75] text-muted-foreground/60 transition-colors group-focus-within:text-foreground/80" />
        </div>
        <textarea
          ref={textareaRef}
          className="max-h-36 min-h-[42px] flex-1 resize-none bg-transparent p-0 text-[13px] leading-relaxed tracking-tight outline-none placeholder:text-muted-foreground/50"
          placeholder="Add a todo, #tag to file it..."
          rows={2}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onSearchChange(searchQueryFromDraft(event.target.value));
            resize(event.target);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
      </div>

      <div className="flex items-center justify-end pt-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canSubmit}
          className={`size-7 rounded-full transition-all duration-150 ${
            canSubmit
              ? 'bg-foreground text-background shadow-xs hover:bg-foreground hover:opacity-90'
              : 'text-muted-foreground/40 hover:bg-transparent'
          }`}
          onClick={submit}
        >
          <ArrowUp className="size-4 stroke-[2.2]" />
        </Button>
      </div>
    </div>
  );
}
