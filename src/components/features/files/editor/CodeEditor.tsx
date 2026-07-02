import { ChevronDown, ChevronUp, FileText, Save, Search, Send, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AceEditor from 'react-ace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useEditorStore } from '@/stores/EditorStore';
// Import Ace Editor modes
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-typescript';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-css';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-rust';
import 'ace-builds/src-noconflict/mode-golang';
import 'ace-builds/src-noconflict/mode-php';
import 'ace-builds/src-noconflict/mode-ruby';
import 'ace-builds/src-noconflict/mode-xml';
import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/mode-sh';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/mode-dockerfile';
import 'ace-builds/src-noconflict/mode-ini';
import 'ace-builds/src-noconflict/mode-toml';
import 'ace-builds/src-noconflict/ext-language_tools';
// Import themes
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-github';
import { aceMapping, editableExtensions } from './languageMap';

interface CodeEditorProps {
  content: string;
  filePath: string;
  isReadOnly?: boolean;
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
  onSelectionChange?: (selectedText: string) => void;
  onSendToAI?: (selectedText: string) => void;
  onAddToNote?: (selectedText: string) => void;
  className?: string;
}

export function CodeEditor({
  content,
  filePath,
  isReadOnly = false,
  onContentChange,
  onSave,
  onSelectionChange,
  onSendToAI,
  onAddToNote,
  className = '',
}: CodeEditorProps) {
  // Local state
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [aceEditor, setAceEditor] = useState<any>(null);
  const [selection, setSelection] = useState<{
    text: string;
    position: { x: number; y: number };
  } | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const searchMarkerRef = useRef<any>(null);

  // Zustand stores
  const { resolvedTheme } = useThemeContext();
  const {
    showLineNumbers,
    fontSize,
    tabSize,
    searchTerm,
    searchResults,
    currentSearchIndex,
    showSearch,
    setSearchTerm,
    setSearchResults,
    setCurrentSearchIndex,
    setShowSearch,
    resetSearch,
    setCursorPosition,
    getCursorPosition,
  } = useEditorStore();

  const getFileExtension = useCallback(() => {
    const fileName = filePath.split('/').pop() || filePath;
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > -1 ? fileName.substring(lastDot + 1).toLowerCase() : '';
  }, [filePath]);

  const getAceMode = useMemo(() => {
    const extension = getFileExtension();
    return aceMapping[extension] || 'text';
  }, [filePath]);

  // Determine if we should allow editing based on file extension
  const isEditableFile = useMemo(() => {
    const extension = getFileExtension();
    return editableExtensions.includes(extension);
  }, [getFileExtension]);

  // Update edited content when content prop changes
  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  const handleSave = useCallback(async () => {
    if (!onSave || isReadOnly || !isEditableFile) return;

    setIsSaving(true);
    try {
      await onSave(editedContent);
      setIsSaving(false);
    } catch (error) {
      console.error('Failed to save:', error);
      setIsSaving(false);
    }
  }, [onSave, isReadOnly, isEditableFile, editedContent]);

  // Handle cursor position tracking
  useEffect(() => {
    if (!aceEditor) return;

    // Restore cursor position for this file
    const savedPosition = getCursorPosition(filePath);
    if (savedPosition) {
      setTimeout(() => {
        aceEditor.gotoLine(savedPosition.row + 1, savedPosition.column, false);
      }, 100);
    }

    // Add cursor change listener to save position
    const handleCursorChange = () => {
      const cursorPosition = aceEditor.getCursorPosition();
      setCursorPosition(filePath, {
        row: cursorPosition.row,
        column: cursorPosition.column,
      });
    };

    const handleSelectionAndCursor = () => {
      handleCursorChange();
      // Handle text selection for floating toolbar with a small delay
      setTimeout(() => {
        if (aceEditor && typeof aceEditor.getSelectedText === 'function') {
          handleAceSelection(aceEditor);
        }
      }, 10);
    };

    aceEditor.on('changeSelection', handleSelectionAndCursor);
    aceEditor.on('changeCursor', handleCursorChange);

    return () => {
      // Save current cursor position when switching files
      if (aceEditor.getCursorPosition) {
        const cursorPosition = aceEditor.getCursorPosition();
        setCursorPosition(filePath, {
          row: cursorPosition.row,
          column: cursorPosition.column,
        });
      }

      // Clean up listeners
      aceEditor.off('changeSelection', handleSelectionAndCursor);
      aceEditor.off('changeCursor', handleCursorChange);
    };
  }, [aceEditor, filePath, getCursorPosition, setCursorPosition]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSave]);

  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
  };

  const handleAceLoad = useCallback((editor: any) => {
    setAceEditor(editor);
  }, []);

  const handleAceSelection = (aceEditor: any) => {
    // Check if aceEditor and its methods exist
    if (!aceEditor || typeof aceEditor.getSelectedText !== 'function') {
      console.warn('ACE Editor not properly initialized');
      return;
    }

    const selectedText = aceEditor.getSelectedText();

    if (selectedText.trim()) {
      // Get selection position for floating button using ACE's coordinate system
      try {
        const selection = aceEditor.getSelection();
        const range = selection.getRange();
        const renderer = aceEditor.renderer;

        // Get pixel position relative to the editor
        const pixelPos = renderer.textToScreenCoordinates(range.end.row, range.end.column);

        if (editorContainerRef.current && pixelPos) {
          const containerRect = editorContainerRef.current.getBoundingClientRect();
          const editorElement = aceEditor.container;
          const editorRect = editorElement.getBoundingClientRect();

          // Calculate position relative to the container
          const x = pixelPos.pageX - editorRect.left + 10;
          const y = pixelPos.pageY - editorRect.top - 40;

          // Make sure the button stays within bounds
          const maxX = containerRect.width - 100;
          const maxY = containerRect.height - 40;

          const position = {
            x: Math.min(Math.max(10, x), maxX),
            y: Math.max(10, Math.min(y, maxY)),
          };

          setSelection({ text: selectedText, position });
        }
      } catch (error) {
        console.warn('Could not calculate selection position:', error);
        // Fallback to a simple position
        setSelection({ text: selectedText, position: { x: 100, y: 50 } });
      }
    } else {
      setSelection(null);
    }

    if (onSelectionChange) {
      onSelectionChange(selectedText);
    }
  };

  // Search functionality
  const performSearch = useCallback(
    (term: string, targetContent: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        setCurrentSearchIndex(-1);
        return;
      }

      const lines = targetContent.split('\n');
      const results: number[] = [];

      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(term.toLowerCase())) {
          results.push(index);
        }
      });

      setSearchResults(results);
      setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    },
    [setSearchResults, setCurrentSearchIndex]
  );

  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      performSearch(term, editedContent);
    },
    [editedContent, performSearch, setSearchTerm]
  );

  const handleSearchNext = () => {
    if (searchResults.length > 0) {
      const newIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
      setCurrentSearchIndex(newIndex);
    }
  };

  const handleSearchPrev = () => {
    if (searchResults.length > 0) {
      const newIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
      setCurrentSearchIndex(newIndex);
    }
  };

  const toggleSearch = () => {
    if (showSearch) {
      resetSearch();
    } else {
      setShowSearch(true);
    }
  };

  // Effect to handle search navigation in Ace Editor
  useEffect(() => {
    if (aceEditor && searchResults.length > 0 && currentSearchIndex >= 0 && showSearch) {
      const targetLine = searchResults[currentSearchIndex];
      aceEditor.gotoLine(targetLine + 1, 0, true);
      aceEditor.scrollToLine(targetLine, true, true, () => {});

      // Highlight search term
      if (searchTerm) {
        try {
          const Range = (window as any).ace?.require('ace/range').Range;
          if (Range) {
            if (searchMarkerRef.current) {
              aceEditor.removeMarker(searchMarkerRef.current);
            }
            const currentContent = editedContent;
            const lines = currentContent.split('\n');
            const line = lines[targetLine];
            const index = line.toLowerCase().indexOf(searchTerm.toLowerCase());
            if (index >= 0) {
              const range = new Range(targetLine, index, targetLine, index + searchTerm.length);
              searchMarkerRef.current = aceEditor.addMarker(range, 'ace_selected-word', 'text');
            }
          }
        } catch (e) {
          console.warn('Could not highlight search term:', e);
        }
      }
    }
  }, [aceEditor, searchResults, currentSearchIndex, searchTerm, showSearch]);

  // Hide floating button when clicking elsewhere or when selection changes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't hide if clicking on the floating button itself
      if (target.closest('[data-floating-selection-toolbar]')) {
        return;
      }

      if (selection && editorContainerRef.current && !editorContainerRef.current.contains(target)) {
        setSelection(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selection]);

  const currentContent = editedContent;
  const aceTheme = resolvedTheme === 'dark' ? 'monokai' : 'github';

  useEffect(() => {
    if (!aceEditor || typeof aceEditor.setTheme !== 'function') return;
    aceEditor.setTheme(`ace/theme/${aceTheme}`);
  }, [aceEditor, aceTheme]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div
        className={`flex items-center gap-1 p-2 border-b ${resolvedTheme === 'dark' ? 'border-border bg-card' : 'border-gray-200 bg-gray-50'}`}
      >
        {!isReadOnly && isEditableFile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="p-1 h-auto"
            title="Save changes (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSearch}
          className="p-1 h-auto"
          title="Search in file"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div
          className={`flex items-center gap-2 p-2 border-b ${resolvedTheme === 'dark' ? 'border-border bg-card' : 'border-gray-200 bg-gray-50'}`}
        >
          <Search
            className={`w-4 h-4 ${resolvedTheme === 'dark' ? 'text-muted-foreground' : 'text-gray-400'}`}
          />
          <Input
            type="text"
            placeholder="Search in file..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  handleSearchPrev();
                } else {
                  handleSearchNext();
                }
              } else if (e.key === 'Escape') {
                toggleSearch();
              }
            }}
            className="flex-1 h-8"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="flex items-center gap-1">
              <span
                className={`text-xs ${resolvedTheme === 'dark' ? 'text-muted-foreground' : 'text-gray-600'}`}
              >
                {currentSearchIndex + 1} of {searchResults.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSearchPrev}
                className="p-1 h-auto"
                title="Previous match"
              >
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSearchNext}
                className="p-1 h-auto"
                title="Next match"
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSearch}
            className="p-1 h-auto"
            title="Close search"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden relative" ref={editorContainerRef}>
        {/* Floating Selection Actions */}
        {selection?.text.trim() && selection.position && (onSendToAI || onAddToNote) && (
          <div
            data-floating-selection-toolbar
            className={`absolute z-10 flex items-center gap-1 p-1 rounded shadow-lg border ${
              resolvedTheme === 'dark' ? 'bg-card border-border' : 'bg-white border-gray-200'
            }`}
            style={{
              left: selection.position.x,
              top: selection.position.y,
              transform: 'translateX(-50%)',
            }}
          >
            {onSendToAI && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSendToAI(selection.text);
                  setSelection(null);
                }}
                className="p-1 h-auto"
                title="Send selected text to AI"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
            {onAddToNote && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onAddToNote(selection.text);
                  setSelection(null);
                }}
                className="p-1 h-auto"
                title="Add selected text to note"
              >
                <FileText className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        <AceEditor
          mode={getAceMode}
          theme={aceTheme}
          value={currentContent}
          readOnly={isReadOnly || !isEditableFile}
          enableBasicAutocompletion={!isReadOnly && isEditableFile}
          enableLiveAutocompletion={false}
          enableSnippets={false}
          fontSize={fontSize}
          width="100%"
          height="100%"
          showPrintMargin={false}
          showGutter={showLineNumbers}
          highlightActiveLine={!isReadOnly && isEditableFile}
          setOptions={{
            tabSize: tabSize,
            wrap: true,
            useWorker: false, // Disable worker to avoid console errors
          }}
          onChange={(value) => {
            if (!isReadOnly && isEditableFile) {
              handleContentChange(value);
            }
          }}
          onSelectionChange={(_, editorInstance) => {
            if (editorInstance && typeof editorInstance.getSelectedText === 'function') {
              handleAceSelection(editorInstance);
            }
          }}
          onLoad={handleAceLoad}
        />
      </div>
    </div>
  );
}
