import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { type DictationDownloadProgress } from '@/services/apiAdapt/dictation';
import { DICTATION_MODELS } from '@/stores/settings/useDictationStore';

interface DictationPopoverContentProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  // Confirms the chosen model and kicks off download + dictation.
  // Undefined when the popover is only used for switching models later on
  // (e.g. no confirm step needed once a model is already ready).
  onConfirmModel?: (modelId: string) => void;
  // Cancels an in-progress download. Only relevant while modelStatus is
  // 'downloading'.
  onCancelDownload?: () => void;
  modelStatus: {
    state: 'missing' | 'downloading' | 'ready' | 'error';
    progress: DictationDownloadProgress | null;
    error: string | null;
  } | null;
  downloadProgress: DictationDownloadProgress | null | undefined;
}

export function DictationPopoverContent({
  selectedModelId,
  onModelChange,
  onConfirmModel,
  onCancelDownload,
  modelStatus,
  downloadProgress,
}: DictationPopoverContentProps) {
  const { t } = useTranslation('settings');
  const selectedModel =
    DICTATION_MODELS.find((m) => m.id === selectedModelId) ?? DICTATION_MODELS[1];
  const isDownloading = modelStatus?.state === 'downloading';
  const downloadPercent = downloadProgress?.totalBytes
    ? Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100)
    : null;

  return (
    <div className="space-y-1">
      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{t('dictationModel')}</p>
      {DICTATION_MODELS.map((model) => (
        <button
          key={model.id}
          onClick={() => onModelChange(model.id)}
          disabled={isDownloading}
          className={cn(
            'w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors',
            isDownloading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            selectedModelId === model.id
              ? 'bg-accent text-accent-foreground'
              : !isDownloading && 'hover:bg-accent'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-medium">{model.label}</span>
              <span className="text-xs text-muted-foreground">
                {model.note} {model.size}
              </span>
            </div>
            {selectedModelId === model.id && <span className="text-xs text-primary">✓</span>}
          </div>
        </button>
      ))}
      <hr className="my-1" />
      <div className="px-2 py-1 text-xs text-muted-foreground">
        {t('currentModel', { label: selectedModel.label, size: selectedModel.size })}
        {modelStatus && !isDownloading && (
          <>
            {' — '}
            {modelStatus.state === 'ready' && t('modelReady')}
            {modelStatus.state === 'missing' && t('modelNotDownloaded')}
            {modelStatus.state === 'error' && (
              <>
                {t('modelError')}: {modelStatus.error ?? t('unknownError')}
              </>
            )}
          </>
        )}
      </div>
      {isDownloading && (
        <div className="px-2 py-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('modelDownloading')}</span>
            <span>{downloadPercent !== null ? `${downloadPercent}%` : ''}</span>
          </div>
          <Progress value={downloadPercent ?? undefined} className="h-1.5" />
          {onCancelDownload && (
            <Button size="sm" variant="outline" className="w-full" onClick={onCancelDownload}>
              {t('cancelDownload', { defaultValue: 'Cancel download' })}
            </Button>
          )}
        </div>
      )}
      {onConfirmModel && !isDownloading && (
        <Button size="sm" className="w-full" onClick={() => onConfirmModel(selectedModelId)}>
          {t('downloadAndUseModel', { defaultValue: 'Download & start' })}
        </Button>
      )}
    </div>
  );
}
