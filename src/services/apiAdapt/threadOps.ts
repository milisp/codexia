import type {
  ExternalAgentConfigDetectParams,
  ExternalAgentConfigDetectResponse,
  ExternalAgentConfigImportHistoriesReadResponse,
  ExternalAgentConfigImportHistoryRecordParams,
  ExternalAgentConfigImportHistoryRecordResponse,
  ExternalAgentConfigImportParams,
  ExternalAgentConfigImportResponse,
  HooksListParams,
  HooksListResponse,
  MemoryResetResponse,
  ThreadCompactStartParams,
  ThreadCompactStartResponse,
  ThreadMemoryModeSetParams,
  ThreadMemoryModeSetResponse,
} from '@/bindings/v2';
import { dual } from './shared';

export async function threadCompactStart(params: ThreadCompactStartParams) {
  return await dual<ThreadCompactStartResponse>(
    'thread_compact_start',
    { params },
    '/api/codex/thread/compact/start',
    params
  );
}

export async function threadMemoryModeSet(params: ThreadMemoryModeSetParams) {
  return await dual<ThreadMemoryModeSetResponse>(
    'thread_memory_mode_set',
    { params },
    '/api/codex/thread/memory-mode/set',
    params
  );
}

export async function memoryReset() {
  return await dual<MemoryResetResponse>(
    'memory_reset',
    { params: {} },
    '/api/codex/memory/reset',
    {}
  );
}

export async function hooksList(params: HooksListParams) {
  return await dual<HooksListResponse>('hooks_list', { params }, '/api/codex/hooks/list', params);
}

export async function externalAgentConfigDetect(params: ExternalAgentConfigDetectParams) {
  return await dual<ExternalAgentConfigDetectResponse>(
    'external_agent_config_detect',
    { params },
    '/api/codex/external-agent-config/detect',
    params
  );
}

export async function externalAgentConfigImport(params: ExternalAgentConfigImportParams) {
  return await dual<ExternalAgentConfigImportResponse>(
    'external_agent_config_import',
    { params },
    '/api/codex/external-agent-config/import',
    params
  );
}

export async function externalAgentConfigImportRecordHistory(
  params: ExternalAgentConfigImportHistoryRecordParams
) {
  return await dual<ExternalAgentConfigImportHistoryRecordResponse>(
    'external_agent_config_import_record_history',
    { params },
    '/api/codex/external-agent-config/import/record-history',
    params
  );
}

export async function externalAgentConfigImportReadHistories() {
  return await dual<ExternalAgentConfigImportHistoriesReadResponse>(
    'external_agent_config_import_read_histories',
    { params: {} },
    '/api/codex/external-agent-config/import/read-histories',
    {}
  );
}
