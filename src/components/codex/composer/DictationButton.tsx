import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Loader2, Mic, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { isDesktopTauri } from '@/hooks/runtime';
import { cn } from '@/lib/utils';
import {
  type DictationEvent,
  type DictationModelStatus,
  type DictationSessionState,
  dictationCancel,
  dictationCancelDownload,
  dictationDownloadModel,
  dictationModelStatus,
  dictationStart,
  dictationStop,
} from '@/services/tauri/dictation';
import { DictationPopoverContent } from './DictationPopoverContent';
import { DownloadProgressRing } from './DownloadProgressRing';
import { useDictationStore } from '@/stores/settings/useDictationStore';

interface DictationButtonProps {
  onTranscript: (text: string) => void;
}

const DOWNLOAD_POLL_INTERVAL_MS = 300;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000; // model files can be a few GB

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mic toggle button that drives on-device dictation (mic capture + Whisper
 * transcription, see codexia_shared::dictation). Idle -> tap to start
 * listening -> tap again to stop and transcribe -> transcript is appended
 * to the composer via onTranscript.
 */
export function DictationButton({ onTranscript }: DictationButtonProps) {
   const [sessionState, setSessionState] = useState<DictationSessionState>('idle');
   const sessionStateRef = useRef(sessionState);
   sessionStateRef.current = sessionState;
   const [modelStatus, setModelStatus] = useState<DictationModelStatus | null>(null);
   const [isPreparingModel, setIsPreparingModel] = useState(false);
   const [isPickerOpen, setIsPickerOpen] = useState(false);
   const {
    selectedModelId,
    setSelectedModelId,
    showModelSelectionDialog,
    setShowModelSelectionDialog,
  } = useDictationStore();
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const modelReady = modelStatus?.state === 'ready';
  const downloadProgress = modelStatus?.progress;

  useEffect(() => {
    if (!isDesktopTauri()) return;

    let cancelled = false;
    const fetchStatus = async () => {
      const status = await dictationModelStatus(selectedModelId);
      if (!cancelled) setModelStatus(status);
    };
    fetchStatus();

    let unlisten: UnlistenFn | null = null;
    listen<DictationEvent>('dictation-event', (event) => {
      const payload = event.payload;
      switch (payload.type) {
        case 'state':
          setSessionState(payload.state);
          break;
        case 'transcript':
          if (payload.text.trim()) {
            onTranscriptRef.current(payload.text);
          }
          break;
        case 'error':
          console.error('Dictation error:', payload.message);
          toast.error(payload.message);
          break;
        default:
          break;
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    // Also listen for download progress events
    let unlistenDownload: UnlistenFn | null = null;
    listen<DictationModelStatus>('dictation-download', (event) => {
      const status = event.payload;
      console.log('[dictation] dictation-download event', status);
      if (!cancelled && status.modelId === selectedModelId) {
        setModelStatus(status);
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenDownload = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
      unlistenDownload?.();
    };
  }, [selectedModelId]);

  const handleModelChange = useCallback(
    async (modelId: string) => {
      if (modelId === selectedModelId) return;
      setSelectedModelId(modelId);
      // Reset status for new model; will be updated by effect/listener
      setModelStatus(null);
      setIsPickerOpen(false);
    },
    [selectedModelId, setSelectedModelId]
  );

  const handleCancelDownload = useCallback(async () => {
    setIsPreparingModel(false);
    setIsPickerOpen(false);
    try {
      const status = await dictationCancelDownload(selectedModelId);
      setModelStatus(status);
    } catch (error) {
      console.error('Failed to cancel dictation model download:', error);
      toast.error(`Failed to cancel download: ${error}`);
    }
  }, [selectedModelId]);

  // Called when the user confirms a model choice in the picker.
  const handleConfirmModel = useCallback(
    async (modelId: string) => {
      setSelectedModelId(modelId);
      setShowModelSelectionDialog(false);
      setIsPickerOpen(false);
      setIsPreparingModel(true);
      try {
        await dictationDownloadModel(modelId);

        // Poll until download finishes (or fails).
        const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
        let status = await dictationModelStatus(modelId);
        while (status.state === 'downloading' && Date.now() < deadline) {
          await sleep(DOWNLOAD_POLL_INTERVAL_MS);
          status = await dictationModelStatus(modelId);
        }

        if (status.state !== 'ready') {
          throw new Error(status.error ?? 'Failed to download dictation model.');
        }
        setModelStatus(status);
        await dictationStart(undefined, modelId);
      } catch (error) {
        console.error('Failed to start dictation:', error);
        toast.error(`Failed to start dictation: ${error}`);
      } finally {
        setIsPreparingModel(false);
      }
    },
    [setSelectedModelId, setShowModelSelectionDialog]
  );

  const handleClick = useCallback(async () => {
    console.log('[dictation] handleClick fired', {
      isDesktopTauri: isDesktopTauri(),
      sessionState: sessionStateRef.current,
      isPreparingModel,
      isPickerOpen,
    });
    if (!isDesktopTauri()) return;

    // Download in progress: clicking again just reopens the picker so the
    // user can check progress, cancel, or switch models — it doesn't
    // restart anything.
    if (isPreparingModel) {
      console.log('[dictation] branch: isPreparingModel -> opening picker');
      setIsPickerOpen(true);
      return;
    }

    const currentState = sessionStateRef.current;
    if (currentState === 'listening') {
      console.log('[dictation] branch: listening -> stop');
      try {
        await dictationStop();
      } catch (error) {
        console.error('Failed to stop dictation:', error);
        toast.error(`Failed to stop dictation: ${error}`);
      }
      return;
    }

    if (currentState === 'processing') {
      console.log('[dictation] branch: processing -> cancel');
      try {
        await dictationCancel();
      } catch (error) {
        console.error('Failed to cancel dictation:', error);
        toast.error(`Failed to cancel dictation: ${error}`);
      }
      return;
    }

    // Idle: check model status first (ask backend for fresh status),
    // then either open picker (if model not ready) or start dictation.
    console.log('[dictation] click', {
      selectedModelId,
      showModelSelectionDialog,
      cachedModelStatus: modelStatus,
    });
    const status = await dictationModelStatus(selectedModelId);
    console.log('[dictation] fresh status', status);
    setModelStatus(status);
    if (status.state !== 'ready') {
      console.log('[dictation] opening picker: model not ready');
      setIsPickerOpen(true);
      return;
    }

    console.log('[dictation] proceeding to dictationStart');
    try {
      await dictationStart(undefined, selectedModelId);
    } catch (error) {
      console.error('Failed to start dictation:', error);
      toast.error(`Failed to start dictation: ${error}`);
    }
  }, [selectedModelId, isPreparingModel]);

  if (!isDesktopTauri()) {
    return null;
  }

  // Only "processing" (transcribing) blocks interaction; a download in
  // progress stays clickable so the user can reopen the picker to check
  // progress, cancel, or switch models.
  const isBusy = sessionState === 'processing';
  const isListening = sessionState === 'listening';
  const downloadPercent = downloadProgress?.totalBytes
    ? (downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100
    : null;

  return (
    <Popover
      open={isPickerOpen}
      onOpenChange={(next) => {
        console.log('[dictation] Popover onOpenChange', { next, sessionState });
        setIsPickerOpen(next);
      }}
    >
      <PopoverAnchor asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={handleClick}
          disabled={isBusy}
          title={
            isPreparingModel
              ? `Downloading dictation model…${downloadPercent !== null ? ` ${Math.round(downloadPercent)}%` : ''}`
              : isListening
                ? 'Stop dictation'
                : 'Start dictation'
          }
          className={cn('h-8 w-8', isListening && 'text-red-600 hover:bg-red-50')}
        >
          {isPreparingModel ? (
            <DownloadProgressRing percent={downloadPercent} className="text-foreground" />
          ) : isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isListening ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </PopoverAnchor>
      <PopoverContent className="w-64 p-2" side="bottom" align="start">
        <DictationPopoverContent
          selectedModelId={selectedModelId}
          onModelChange={handleModelChange}
          onConfirmModel={!modelReady ? handleConfirmModel : undefined}
          onCancelDownload={isPreparingModel ? handleCancelDownload : undefined}
          modelStatus={modelStatus}
          downloadProgress={downloadProgress}
        />
      </PopoverContent>
    </Popover>
  );
}