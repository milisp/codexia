import { en } from './en';
import { ja } from './ja';
import { zh } from './zh';

export const localeResources = {
  en: { ...en },
  zh: { ...zh },
  ja: { ...ja },
} as const;

export type AppLocale = keyof typeof localeResources;

export const localeLabels: Record<AppLocale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
};
