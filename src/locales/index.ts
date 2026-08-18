import { en } from './en';
import { fr } from './fr';
import { ja } from './ja';
import { zh } from './zh';

export const localeResources = {
  en: { ...en },
  zh: { ...zh },
  ja: { ...ja },
  fr: { ...fr },
} as const;

export type AppLocale = keyof typeof localeResources;

export const localeLabels: Record<AppLocale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  fr: 'Français',
};
