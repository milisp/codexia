import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocaleStore } from '@/stores/settings/useLocaleStore';
import type { AppLocale } from '@/locales';
import { supportedLocales } from '@/lib/i18n';

export function LanguageSelector() {
  const { t } = useTranslation("header");
  const { locale, setLocale } = useLocaleStore();

  const options = [
    { code: 'auto', label: t('autoDetect') },
    ...supportedLocales.map(({ code, label }) => ({ code, label }))
  ];

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{t('language')}</div>
        <div className="text-xs text-muted-foreground">{t('changeLanguage')}</div>
      </div>
      <Select value={locale} onValueChange={(value) => setLocale(value as AppLocale | 'auto')}>
        <SelectTrigger className="h-8 w-[180px] text-xs" aria-label={t('changeLanguage')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {options.map(({ code, label }) => (
            <SelectItem key={code} value={code} className="text-xs">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}