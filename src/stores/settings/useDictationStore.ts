import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DictationModel {
  id: string;
  label: string;
  size: string;
  note: string;
}

// Mirror of Tauri's MODEL_CATALOG (src-tauri/src/dictation/real.rs)
export const DICTATION_MODELS: DictationModel[] = [
  { id: 'tiny', label: 'Tiny', size: '75 MB', note: 'Fastest, least accurate.' },
  { id: 'base', label: 'Base', size: '142 MB', note: 'Balanced default.' },
  { id: 'small', label: 'Small', size: '466 MB', note: 'Better accuracy.' },
  { id: 'medium', label: 'Medium', size: '1.5 GB', note: 'High accuracy.' },
  { id: 'large-v3', label: 'Large V3', size: '3.0 GB', note: 'Best accuracy, heavy download.' },
];

export const DEFAULT_MODEL_ID = 'base';

export interface DictationSettingsState {
  selectedModelId: string;
  showModelSelectionDialog: boolean;
  setSelectedModelId: (modelId: string) => void;
  setShowModelSelectionDialog: (show: boolean) => void;
}

export const useDictationStore = create<DictationSettingsState>()(
  persist(
    (set) => ({
      selectedModelId: DEFAULT_MODEL_ID,
      showModelSelectionDialog: true, // Show dialog on first use if no model selected
      setSelectedModelId: (modelId: string) =>
        set({ selectedModelId: modelId, showModelSelectionDialog: false }),
      setShowModelSelectionDialog: (show: boolean) => set({ showModelSelectionDialog: show }),
    }),
    {
      name: 'dictation-settings-storage',
      version: 1,
    }
  )
);
