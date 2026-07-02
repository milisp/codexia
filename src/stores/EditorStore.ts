import { create } from 'zustand';

interface CursorPosition {
  row: number;
  column: number;
}

interface EditorState {
  // Search state
  searchTerm: string;
  searchResults: number[];
  currentSearchIndex: number;
  showSearch: boolean;
  setSearchTerm: (term: string) => void;
  setSearchResults: (results: number[]) => void;
  setCurrentSearchIndex: (index: number) => void;
  setShowSearch: (show: boolean) => void;

  // Editor preferences
  showLineNumbers: boolean;
  fontSize: number;
  tabSize: number;
  setShowLineNumbers: (show: boolean) => void;
  setFontSize: (size: number) => void;
  setTabSize: (size: number) => void;

  // Cursor position tracking
  cursorPositions: Map<string, CursorPosition>;
  setCursorPosition: (filePath: string, position: CursorPosition) => void;
  getCursorPosition: (filePath: string) => CursorPosition | null;

  // Reset functions
  resetSearch: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Search state
  searchTerm: '',
  searchResults: [],
  currentSearchIndex: -1,
  showSearch: false,
  setSearchTerm: (term) => set({ searchTerm: term }),
  setSearchResults: (results) => set({ searchResults: results }),
  setCurrentSearchIndex: (index) => set({ currentSearchIndex: index }),
  setShowSearch: (show) => set({ showSearch: show }),

  // Editor preferences
  showLineNumbers: true,
  fontSize: 14,
  tabSize: 2,
  setShowLineNumbers: (show) => set({ showLineNumbers: show }),
  setFontSize: (size) => set({ fontSize: size }),
  setTabSize: (size) => set({ tabSize: size }),

  // Cursor position tracking
  cursorPositions: new Map(),
  setCursorPosition: (filePath, position) => {
    const state = get();
    const newPositions = new Map(state.cursorPositions);
    newPositions.set(filePath, position);
    set({ cursorPositions: newPositions });
  },
  getCursorPosition: (filePath) => {
    const state = get();
    return state.cursorPositions.get(filePath) || null;
  },

  // Reset functions
  resetSearch: () =>
    set({
      searchTerm: '',
      searchResults: [],
      currentSearchIndex: -1,
      showSearch: false,
    }),
}));
