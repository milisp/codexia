import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sun, Moon, Monitor, Github, Twitter } from 'lucide-react';
import { useThemeStore, type Theme, type Accent } from '@/stores/settings';
import { LanguageSelector } from './LanguageSelector';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const ACCENT_OPTIONS: Array<{ value: Accent; label: string; colorClass: string }> = [
  { value: 'black', label: 'Noir', colorClass: 'bg-slate-800' },
  { value: 'pink', label: 'Pink', colorClass: 'bg-pink-500' },
  { value: 'blue', label: 'Blue', colorClass: 'bg-blue-500' },
  { value: 'green', label: 'Green', colorClass: 'bg-emerald-500' },
  { value: 'purple', label: 'Purple', colorClass: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', colorClass: 'bg-orange-500' },
];

const LINKS = {
  GITHUB: 'https://github.com/milisp/codexia',
  DISCORD: 'https://discord.gg/zAjtD4kf5K',
  TWITTER: 'https://x.com/lisp_mi',
} as const;

export function GeneralSettings() {
  const { theme, setTheme, accent, setAccent } = useThemeStore();
  const handleThemeChange = (value: string) => setTheme(value as Theme);
  const { t } = useTranslation('settings');

  // Shared Tailwind classes from shadcn/ui Button (variant: default, size: sm)
  const buttonClassName = 'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-3';

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-medium px-1">{t('preferences')}</h3>
        <Card>
          <CardContent className="px-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">{t('appearance')}</div>
                <div className="text-xs text-muted-foreground">
                  {t('appearanceDescription')}
                </div>
              </div>
              <Tabs value={theme} onValueChange={handleThemeChange}>
                <TabsList className="h-8">
                  <TabsTrigger value="light" className="px-3 gap-2 text-xs">
                    <Sun className="h-3.5 w-3.5" />
                    {t('light')}
                  </TabsTrigger>
                  <TabsTrigger value="dark" className="px-3 gap-2 text-xs">
                    <Moon className="h-3.5 w-3.5" />
                    {t('dark')}
                  </TabsTrigger>
                  <TabsTrigger value="system" className="px-3 gap-2 text-xs">
                    <Monitor className="h-3.5 w-3.5" />
                    {t('system')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="h-px bg-border" />
            <div className="space-y-2">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">{t('accentColor')}</div>
                <div className="text-xs text-muted-foreground">
                  {t('accentColorDescription')}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ACCENT_OPTIONS.map(({ value, label, colorClass }) => {
                  const selected = accent === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAccent(value)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors',
                        'hover:bg-accent/60 hover:text-accent-foreground',
                        selected
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border text-foreground'
                      )}
                      aria-pressed={selected}
                      aria-label={`Use ${label} accent color`}
                    >
                      <span className={cn('size-2.5 rounded-full', colorClass)} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="h-px bg-border" />
            <LanguageSelector />
          </CardContent>
        </Card>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium px-1">{t('keepInTouch')}</h3>
        <div className="flex flex-wrap gap-2 text-balance">
          <a
            href={LINKS.GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonClassName, 'flex-1 min-w-[100px]')}
          >
            <Github className="h-4 w-4" />
            <span>Github</span>
          </a>
          <a
            href={LINKS.DISCORD}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonClassName, 'flex-shrink-0')}
          >
            <img src="/discord.svg" height={16} width={16} alt="Discord" />
            <span>Discord</span>
          </a>
          <a
            href={LINKS.TWITTER}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonClassName, 'flex-1 min-w-[100px]')}
          >
            <Twitter className="h-4 w-4" />
            <span>lisp_mi</span>
          </a>
        </div>
      </section>
    </div>
  );
}