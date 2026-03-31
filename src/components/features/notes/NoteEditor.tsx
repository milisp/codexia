import { useEffect, useRef, useState } from 'react';
import MdEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import 'react-markdown-editor-lite/lib/index.css';
import { useThemeContext } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { getNoteById, updateNote } from '@/services/tauri';

type NoteViewProps = {
  noteId: string | null;
  className?: string;
  onContentChange?: (content: string) => void;
  focusToken?: number;
  onSaved?: () => void;
};

const extractTitle = (raw: string) => {
  const firstLine = raw.split(/\r?\n/)[0] || '';
  return firstLine.replace(/^#+\s*/, '').trim() || 'Untitled note';
};

export function NoteEditor({
  noteId,
  className,
  onContentChange,
  focusToken,
  onSaved,
}: NoteViewProps) {
  const [content, setContent] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const debounceRef = useRef<number | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const tagsLoadedRef = useRef(false);
  const latestContentRef = useRef('');
  const lastSavedContentRef = useRef('');
  const isMountedRef = useRef(true);
  const { resolvedTheme } = useThemeContext();
  const mdParser = useRef(new MarkdownIt());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadNote = async () => {
      setSaveError(null);
      if (!noteId) {
        if (isActive) {
          setContent('# New note');
        }
        return;
      }

      try {
        const note = await getNoteById(noteId);
        const nextContent = note?.content ?? '# New note';
        if (isActive) {
          setContent(nextContent);
          latestContentRef.current = nextContent;
          lastSavedContentRef.current = nextContent;
        }
      } catch (err) {
        if (isActive) {
          setContent('# New note');
          latestContentRef.current = '# New note';
          lastSavedContentRef.current = '# New note';
        }
      }
    };

    void loadNote();

    return () => {
      isActive = false;
    };
  }, [noteId]);

  useEffect(() => {
    let isActive = true;

    const loadTags = async () => {
      tagsLoadedRef.current = false;
      if (!noteId) {
        if (isActive) {
          setTags([]);
          setTagInput('');
          tagsLoadedRef.current = true;
        }
        return;
      }
      try {
        const note = await getNoteById(noteId);
        const nextTags = note?.tags ?? [];
        if (isActive) {
          setTags(nextTags);
          setTagInput('');
        }
      } catch (err) {
        if (isActive) {
          setTags([]);
          setTagInput('');
        }
      } finally {
        tagsLoadedRef.current = true;
      }
    };

    void loadTags();

    return () => {
      isActive = false;
    };
  }, [noteId]);

  useEffect(() => {
    if (!noteId || !tagsLoadedRef.current) {
      return;
    }
    const persistTags = async () => {
      try {
        await updateNote(noteId, { tags });
        onSaved?.();
      } catch (err) {
        console.error('Failed to save tags:', err);
      }
    };
    void persistTags();
  }, [noteId, tags, onSaved]);

  const saveNote = async (nextContent: string, options?: { silent?: boolean }) => {
    if (!noteId) {
      return;
    }

    if (!options?.silent && isMountedRef.current) {
      setSaveError(null);
    }
    try {
      await updateNote(noteId, {
        title: extractTitle(nextContent),
        content: nextContent,
      });
      lastSavedContentRef.current = nextContent;
      onSaved?.();
    } catch (err) {
      if (!options?.silent && isMountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setSaveError(message || 'Failed to save note.');
      }
    }
  };

  const scheduleSave = (nextContent: string) => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void saveNote(nextContent);
    }, 700);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      const hasUnsavedContent =
        !!noteId && latestContentRef.current !== lastSavedContentRef.current;
      if (hasUnsavedContent) {
        void saveNote(latestContentRef.current, { silent: true });
      }
    };
  }, [noteId]);

  useEffect(() => {
    if (!focusToken) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      const container = editorRef.current;
      const textarea = container?.querySelector('textarea') as HTMLTextAreaElement | null;
      textarea?.focus();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [focusToken]);

  return (
    <div ref={editorRef} className={`flex w-full flex-1 min-h-0 flex-col ${className ?? ''}`}>
      {saveError ? (
        <div className="border-b border-sidebar px-3 py-2 bg-sidebar/5">
          <span className="text-xs text-destructive">{saveError}</span>
        </div>
      ) : null}
      <div className="border-b border-white/10 bg-sidebar/5 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tags
          </span>
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              <span className="text-[10px] uppercase tracking-wide">{tag}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:text-destructive"
                onClick={() => setTags((prev) => prev.filter((existing) => existing !== tag))}
                title={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const nextTag = tagInput.trim();
                  if (!nextTag) {
                    return;
                  }
                  setTags((prev) => {
                    if (prev.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) {
                      return prev;
                    }
                    return [...prev, nextTag];
                  });
                  setTagInput('');
                }
              }}
              placeholder="Add tag"
              className="h-7 w-32 bg-background/60"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => {
                const nextTag = tagInput.trim();
                if (!nextTag) {
                  return;
                }
                setTags((prev) => {
                  if (prev.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) {
                    return prev;
                  }
                  return [...prev, nextTag];
                });
                setTagInput('');
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
      <div className={`min-h-0 flex-1 overflow-hidden ${resolvedTheme === 'dark' ? 'rc-md-editor-dark' : ''}`}>
        <MdEditor
          value={content}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          view={{ menu: true, md: true, html: false }}
          renderHTML={(text) => mdParser.current.render(text)}
          onChange={({ text }) => {
            setContent(text);
            latestContentRef.current = text;
            onContentChange?.(text);
            scheduleSave(text);
          }}
        />
      </div>
    </div>
  );
}
