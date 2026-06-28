import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AppLocale, localeLabels, localeResources } from '@/locales';
import { useLocaleStore } from '@/stores/settings/useLocaleStore';

const fallbackLocale: AppLocale = 'en';

// Helper to detect locale from navigator
const detectLocale = (): AppLocale => {
  if (typeof navigator === 'undefined') {
    return fallbackLocale;
  }
  const lang = navigator.language.slice(0, 2).toLowerCase();
  // Check if the detected language is supported
  if (['en', 'zh', 'ja'].includes(lang as AppLocale)) {
    return lang as AppLocale;
  }
  return fallbackLocale;
};

const getInitialLocale = (): AppLocale | 'auto' => {
  const stored = useLocaleStore.getState().locale;
  return stored;
};

const initialLocaleValue = getInitialLocale();
const initialLocale = initialLocaleValue === 'auto' ? detectLocale() : initialLocaleValue;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: localeResources,
    lng: initialLocale,
    fallbackLng: fallbackLocale,
    interpolation: {
      escapeValue: false,
    },
  });
}

// Keep the active i18next language in sync with the persisted locale store.
useLocaleStore.subscribe((state) => {
  let newLocale: AppLocale;
  if (state.locale === 'auto') {
    newLocale = detectLocale();
  } else {
    newLocale = state.locale;
  }
  if (i18n.language !== newLocale) {
    void i18n.changeLanguage(newLocale);
  }
});

export { i18n };

export const supportedLocales = (Object.keys(localeResources) as AppLocale[]).map((code) => ({
  code,
  label: localeLabels[code],
}));