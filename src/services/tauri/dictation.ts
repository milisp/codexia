import { invokeTauri, isDesktopTauri } from './shared';

// Dictation runs entirely on-device (mic capture + Whisper transcription) and
// is desktop-only for now; there is no web/remote backend implementation.
const DESKTOP_ONLY_MESSAGE = 'Dictation is only available in the desktop app.';

export type DictationModelState = 'missing' | 'downloading' | 'ready' | 'error';

export type DictationDownloadProgress = {
  downloadedBytes: number;
  totalBytes: number | null;
};

export type DictationModelStatus = {
  state: DictationModelState;
  modelId: string;
  progress: DictationDownloadProgress | null;
  error: string | null;
  path: string | null;
};

export type DictationSessionState = 'idle' | 'listening' | 'processing';

export type DictationEvent =
  | { type: 'state'; state: DictationSessionState }
  | { type: 'level'; value: number }
  | { type: 'transcript'; text: string }
  | { type: 'error'; message: string }
  | { type: 'canceled'; message: string };

export async function dictationModelStatus(modelId?: string): Promise<DictationModelStatus> {
  if (!isDesktopTauri()) {
    return {
      state: 'error',
      modelId: modelId ?? 'base',
      progress: null,
      error: DESKTOP_ONLY_MESSAGE,
      path: null,
    };
  }
  return await invokeTauri<DictationModelStatus>('dictation_model_status', { modelId });
}

export async function dictationDownloadModel(modelId?: string): Promise<DictationModelStatus> {
  return await invokeTauri<DictationModelStatus>('dictation_download_model', { modelId });
}

export async function dictationCancelDownload(modelId?: string): Promise<DictationModelStatus> {
  return await invokeTauri<DictationModelStatus>('dictation_cancel_download', { modelId });
}

export async function dictationRemoveModel(modelId?: string): Promise<DictationModelStatus> {
  return await invokeTauri<DictationModelStatus>('dictation_remove_model', { modelId });
}

export async function dictationStart(
  preferredLanguage?: string,
  modelId?: string
): Promise<DictationSessionState> {
  if (!isDesktopTauri()) {
    throw new Error(DESKTOP_ONLY_MESSAGE);
  }
  return await invokeTauri<DictationSessionState>('dictation_start', {
    preferredLanguage,
    modelId,
  });
}

export async function dictationRequestPermission(): Promise<boolean> {
  if (!isDesktopTauri()) {
    return false;
  }
  return await invokeTauri<boolean>('dictation_request_permission');
}

export async function dictationStop(): Promise<DictationSessionState> {
  return await invokeTauri<DictationSessionState>('dictation_stop');
}

export async function dictationCancel(): Promise<DictationSessionState> {
  return await invokeTauri<DictationSessionState>('dictation_cancel');
}
