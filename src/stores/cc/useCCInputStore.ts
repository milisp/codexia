import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CCInputStore {
  inputValue: string;
  setInputValue: (value: string) => void;
  appendInputValue: (value: string) => void;
  appendFileLinks: (paths: string[], cwd?: string) => void;
  clearInputValue: () => void;
}

export const useCCInputStore = create<CCInputStore>()(
  persist(
    (set) => ({
      inputValue: '',
      setInputValue: (value) => set({ inputValue: value }),
      appendInputValue: (value) =>
        set((state) => {
          const separator =
            state.inputValue.length === 0 || state.inputValue.endsWith(' ') ? '' : ' ';
          return { inputValue: `${state.inputValue}${separator}${value}` };
        }),
      appendFileLinks: (paths, cwd = '') =>
        set((state) => {
          const toPosix = (value: string) => value.replace(/\\/g, '/');
          const normalizedCwd = toPosix(cwd).replace(/\/+$/, '');
          const links = paths.map((path) => {
            const normalizedPath = toPosix(path);
            const relativePath =
              normalizedCwd && normalizedPath.startsWith(`${normalizedCwd}/`)
                ? normalizedPath.slice(normalizedCwd.length + 1)
                : normalizedPath;
            const fileName = normalizedPath.split('/').filter(Boolean).pop() ?? normalizedPath;
            return `[${fileName}](${relativePath})`;
          });

          if (links.length === 0) {
            return state;
          }

          const appended = links.join(' ');
          const separator =
            state.inputValue.length === 0 || state.inputValue.endsWith(' ') ? '' : ' ';
          return { inputValue: `${state.inputValue}${separator}${appended}` };
        }),
      clearInputValue: () => set({ inputValue: '' }),
    }),
    {
      name: 'cc-input-storage',
      version: 2,
    }
  )
);
