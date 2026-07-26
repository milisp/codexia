import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import {
  useDictationStore,
  DICTATION_MODELS,
  type DictationModel,
} from '@/stores/settings/useDictationStore';
import { cn } from '@/lib/utils';

export function DictationSettings() {
  const { t } = useTranslation('settings');
  const { selectedModelId, setSelectedModelId } = useDictationStore();

  const selectedModel =
    DICTATION_MODELS.find((m) => m.id === selectedModelId) ?? DICTATION_MODELS[1];

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium px-1">{t('dictation')}</h3>
      <Card>
        <CardContent className="px-4 py-4 space-y-4">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">{t('dictationModel')}</div>
              <div className="text-xs text-muted-foreground">{t('dictationModelDescription')}</div>
            </div>
            <div className="space-y-1">
              {DICTATION_MODELS.map((model: DictationModel) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm rounded-md border cursor-pointer transition-colors',
                    selectedModelId === model.id
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">{model.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.note} {model.size}
                      </span>
                    </div>
                    {selectedModelId === model.id && (
                      <span className="text-xs text-primary">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {t('currentModel', { label: selectedModel.label, size: selectedModel.size })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
