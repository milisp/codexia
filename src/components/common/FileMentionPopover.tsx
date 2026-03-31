import { useEffect, useRef, useState, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { FileText } from 'lucide-react';
import { searchFiles } from '@/services/tauri/filesystem';
import { useWorkspaceStore } from '@/stores';
import { isTauri } from '@/hooks/runtime';
import {
  useComposerPopover,
  detectAtMention,
  replaceAtTrigger,
  applyEditorReplacement,
} from '@/components/common/useComposerPopover';

interface FileItem {
  name: string;
  path: string;
  relativePath: string;
}

interface FileMentionPopoverProps {
  input: string;
  setInput: (v: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  triggerElement: HTMLElement | null;
}

const getExtension = (name: string) => {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
};

export function FileMentionPopover({
  input,
  setInput,
  editorRef,
  triggerElement,
}: FileMentionPopoverProps) {
  const { cwd } = useWorkspaceStore();
  const [fileResults, setFileResults] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const triggerSpanRef = useRef<HTMLSpanElement | null>(null);

  const handleSelect = useCallback(
    (file: FileItem) => {
      const { cwd: currentCwd } = useWorkspaceStore.getState();
      const toPosix = (v: string) => v.replace(/\\/g, '/');
      const normalizedCwd = toPosix(currentCwd).replace(/\/+$/, '');
      const normalizedPath = toPosix(file.path);
      const relativePath =
        normalizedCwd && normalizedPath.startsWith(`${normalizedCwd}/`)
          ? normalizedPath.slice(normalizedCwd.length + 1)
          : normalizedPath;
      const link = `\`${relativePath}\``;
      const newValue = replaceAtTrigger(input, '@', link);
      if (newValue !== null) applyEditorReplacement(newValue, setInput, editorRef);
      else editorRef.current?.focus();
    },
    [input, setInput, editorRef],
  );

  const { open, setOpen, query, filteredItems, selectedIndex, setSelectedIndex, itemRefs } =
    useComposerPopover({
      input,
      items: fileResults,
      detect: detectAtMention,
      onKeySelect: handleSelect,
    });

  // Search files via backend whenever open or query changes
  useEffect(() => {
    if (!open || !cwd) return;
    let isActive = true;

    const doSearch = async () => {
      setLoading(true);
      try {
        const toPosix = (v: string) => v.replace(/\\/g, '/');
        const normalizedCwd = toPosix(cwd).replace(/\/+$/, '');
        const entries = await searchFiles({ root: cwd, query, excludeFolders: [], maxResults: 50 });
        if (!isActive) return;
        setFileResults(
          entries.map((e) => {
            const normalizedPath = toPosix(e.path);
            const relativePath = normalizedPath.startsWith(`${normalizedCwd}/`)
              ? normalizedPath.slice(normalizedCwd.length + 1)
              : normalizedPath;
            return { name: e.name, path: e.path, relativePath };
          }),
        );
      } catch (error) {
        console.error('Failed to search files:', error);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    const timer = setTimeout(() => { void doSearch(); }, query ? 150 : 0);
    return () => { isActive = false; clearTimeout(timer); };
  }, [open, cwd, query]);

  // Pin trigger span to the editor wrapper position
  useEffect(() => {
    const el = triggerSpanRef.current;
    if (!el || !triggerElement) return;
    const rect = triggerElement.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = '0';
    el.style.height = '0';
    el.style.pointerEvents = 'none';
  }, [triggerElement]);

  const shouldUseSvgFileIcon = isTauri();

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <span ref={triggerSpanRef} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 max-h-72 overflow-hidden flex flex-col shadow-xl z-50"
        side="top"
        align="start"
        sideOffset={4}
        avoidCollisions={true}
        onKeyDown={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="overflow-y-auto flex-1 py-1">
          {loading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">No files found</div>
          ) : (
            filteredItems.map((file, index) => {
              const extension = getExtension(file.name);
              const iconStyle =
                extension && extension in defaultStyles
                  ? defaultStyles[extension as keyof typeof defaultStyles]
                  : defaultStyles.txt;
              return (
                <Button
                  key={file.path}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  variant={index === selectedIndex ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-2 h-auto py-1.5 px-3 text-xs rounded-none"
                  onClick={() => handleSelect(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                    {shouldUseSvgFileIcon ? (
                      <FileIcon extension={extension} color={iconStyle.color} />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="font-medium truncate">{file.name}</span>
                  <span className="ml-auto text-muted-foreground truncate max-w-[120px] text-right shrink-0">
                    {file.relativePath.includes('/')
                      ? file.relativePath.slice(0, file.relativePath.lastIndexOf('/'))
                      : ''}
                  </span>
                </Button>
              );
            })
          )}
        </div>
        <div className="border-t px-3 py-1.5 bg-muted/30 flex items-center gap-3 text-xs text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>Enter/Tab Select</span>
          <span>Esc Close</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
