import type { UnlistenFn } from '@tauri-apps/api/event';
import { listen } from '@tauri-apps/api/event';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useThemeContext } from '@/contexts/ThemeContext';
import { isTauri } from '@/hooks/runtime';
import {
  canonicalizePath,
  readFile,
  readPdfContent,
  readXlsxContent,
  unwatchDirectory,
  watchDirectory,
  writeFile,
} from '@/services';
import { useInputStore, useNoteStore } from '@/stores';
import { getErrorMessage } from '@/utils/errorUtils';
import { getFilename } from '@/utils/getFilename';
import { CodeEditor } from '../editor/CodeEditor';

interface FileViewerProps {
  filePath: string;
}

export function FileViewer({ filePath }: FileViewerProps) {
  const isTauriRuntime = isTauri();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);
  const [_, setSelectedText] = useState<string>('');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [diskChanged, setDiskChanged] = useState(false);
  const prevWatchedDirRef = useRef<string | null>(null);
  const [canonicalFile, setCanonicalFile] = useState<string | null>(null);
  const [fileTrigger, setFileTrigger] = useState(0);
  const { resolvedTheme } = useThemeContext();
  const { setInputValue } = useInputStore();
  const { addNote } = useNoteStore();

  const getFileExtension = (path: string) => {
    const base = getFilename(path);
    const lastDot = base.lastIndexOf('.');
    return lastDot > -1 ? base.substring(lastDot + 1).toLowerCase() : '';
  };

  const loadFile = async () => {
    setLoading(true);
    setError(null);

    try {
      const extension = getFileExtension(filePath);
      let fileContent: string;

      switch (extension) {
        case 'pdf':
          fileContent = await readPdfContent(filePath);
          break;
        case 'xlsx':
          fileContent = await readXlsxContent(filePath);
          break;
        default:
          fileContent = await readFile(filePath);
          break;
      }

      setContent(fileContent);
      setCurrentContent(fileContent);
      setDiskChanged(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const prevFilePathRef = useRef(filePath);
  if (filePath !== prevFilePathRef.current) {
    prevFilePathRef.current = filePath;
    setFileTrigger((prev) => prev + 1);
  }

  // Reset content/error inline during render when filePath becomes falsy
  if (!filePath && (content !== '' || error !== null)) {
    setContent('');
    setError(null);
  }

  useEffect(() => {
    if (fileTrigger === 0) return;
    if (!filePath) {
      return;
    }
    loadFile();
    (async () => {
      try {
        const c = await canonicalizePath(filePath);
        setCanonicalFile(c);
      } catch {
        setCanonicalFile(filePath);
      }
    })();
  }, [filePath, fileTrigger]);

  useEffect(() => {
    setCurrentContent(content);
  }, [content]);

  const handleSave = async (newContent: string) => {
    if (!filePath) return;

    try {
      await writeFile(filePath, newContent);
      setContent(newContent);
      setCurrentContent(newContent);
    } catch (err) {
      console.error('Failed to save file:', err);
      throw new Error(`Failed to save file: ${err}`);
    }
  };

  const handleSelectionChange = (newSelectedText: string) => {
    setSelectedText(newSelectedText);
  };

  const handleContentChange = (newContent: string) => {
    setCurrentContent(newContent);
  };

  const handleToggleContent = () => {
    setShowFullContent(!showFullContent);
  };

  const MAX_LINES = 500;
  const isLargeFile = content.split('\n').length > MAX_LINES;

  const displayContent = showFullContent
    ? content
    : (() => {
        const lines = content.split('\n');
        if (lines.length <= MAX_LINES) return content;
        return lines.slice(0, MAX_LINES).join('\n');
      })();

  // Watch parent directory of the open file so we reliably get fs_change events
  useEffect(() => {
    if (!filePath || !isTauriRuntime) {
      return;
    }

    const parentDir = filePath.includes('/')
      ? filePath.slice(0, filePath.lastIndexOf('/'))
      : filePath;
    const start = async () => {
      try {
        await watchDirectory(parentDir);
      } catch {}
    };
    const stopPrev = async () => {
      const prev = prevWatchedDirRef.current;
      if (prev && prev !== parentDir) {
        try {
          await unwatchDirectory(prev);
        } catch {}
      }
    };
    start();
    stopPrev();
    prevWatchedDirRef.current = parentDir;
    return () => {
      (async () => {
        try {
          await unwatchDirectory(parentDir);
        } catch {}
      })();
    };
  }, [filePath, isTauriRuntime]);

  // Listen to fs_change to detect disk updates for the open file
  useEffect(() => {
    if (!filePath || !isTauriRuntime) {
      return;
    }

    let unlisten: UnlistenFn | null = null;
    const setup = async () => {
      unlisten = await listen<{ path: string; kind: string }>('fs_change', async (event) => {
        const changed = event.payload.path;
        if (!filePath) return;
        const target = canonicalFile || filePath;
        if (changed === target) {
          // If user hasn't modified content, auto-reload; otherwise show a banner
          if (currentContent === content) {
            await loadFile();
          } else {
            setDiskChanged(true);
          }
        }
      });
    };
    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [filePath, canonicalFile, content, currentContent, isTauriRuntime]);

  if (!filePath) return null;

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Tab-style header — Zed-inspired: tight, no heavy background */}
      <div className="flex-1 overflow-hidden">
        {diskChanged && (
          <div
            className={`px-3 py-2 text-xs flex items-center justify-between ${resolvedTheme === 'dark' ? 'bg-amber-950 text-amber-300' : 'bg-amber-50 text-amber-800'}`}
          >
            <span>File changed on disk.</span>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2"
                onClick={() => setDiskChanged(false)}
              >
                Dismiss
              </Button>
              <Button variant="default" size="sm" className="h-6 px-2" onClick={loadFile}>
                Reload
              </Button>
            </div>
          </div>
        )}
        {loading ? (
          <div
            className={`h-full p-6 flex flex-col items-center justify-center gap-4 ${resolvedTheme === 'dark' ? 'text-muted-foreground' : 'text-gray-500'}`}
          >
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Loading file...</span>
            </div>
            <div className="w-full max-w-xl space-y-2">
              <div
                className={`h-3 rounded animate-pulse ${resolvedTheme === 'dark' ? 'bg-muted' : 'bg-gray-200'}`}
              />
              <div
                className={`h-3 rounded animate-pulse ${resolvedTheme === 'dark' ? 'bg-muted' : 'bg-gray-200'}`}
              />
              <div
                className={`h-3 rounded w-2/3 animate-pulse ${resolvedTheme === 'dark' ? 'bg-muted' : 'bg-gray-200'}`}
              />
            </div>
          </div>
        ) : error ? (
          <div
            className={`p-4 text-center ${resolvedTheme === 'dark' ? 'text-destructive' : 'text-red-500'}`}
          >
            {error}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <CodeEditor
              content={displayContent}
              filePath={filePath}
              onContentChange={handleContentChange}
              onSave={handleSave}
              onSelectionChange={handleSelectionChange}
              onSendToAI={(text) => {
                setInputValue(text);
              }}
              onAddToNote={(text) => {
                addNote(text);
              }}
              className="flex-1"
            />
            {isLargeFile && !showFullContent && (
              <div
                className={`p-4 text-center border-t ${resolvedTheme === 'dark' ? 'border-border bg-card' : 'border-gray-200 bg-gray-50'}`}
              >
                <p
                  className={`text-sm mb-2 ${resolvedTheme === 'dark' ? 'text-muted-foreground' : 'text-gray-600'}`}
                >
                  Showing first {MAX_LINES} lines of {content.split('\n').length} total lines
                </p>
                <Button variant="outline" size="sm" onClick={handleToggleContent}>
                  Show All Lines
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
