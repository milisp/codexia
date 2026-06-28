import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppLocale } from '@/locales';

interface LocaleState {
  locale: AppLocale | 'auto';
  setLocale: (locale: AppLocale | 'auto') => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale: AppLocale | 'auto') => set({ locale }),
    }),
    {
      name: 'locale-storage',
    }
  )
);
