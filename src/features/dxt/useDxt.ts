import { useEffect, useState } from 'react';
import type { z } from 'zod';
import {
  checkManifestsExist,
  downloadAndExtractManifests,
  loadManifests as loadDxtManifests,
} from '@/services';
import { DxtManifestSchema } from './schemas';

// Utility to normalize manifest data
function normalizeManifest(obj: any, index: number) {
  for (const key in obj) {
    if (obj[key] === null) obj[key] = undefined;
  }

  const cleaned = {
    id: index,
    ...obj,
    version: obj.version || obj.dxt_version || obj.server?.version || '1.0.0',
    tools_generated: obj.tools_generated ?? false,
    prompts_generated: obj.prompts_generated ?? false,
    homepage: isValidUrl(obj.homepage) ? obj.homepage : undefined,
    documentation: isValidUrl(obj.documentation) ? obj.documentation : undefined,
    support: isValidUrl(obj.support) ? obj.support : undefined,
    user_config: obj.user_config ? cleanUserConfig(obj.user_config) : undefined,
  };

  const allowedFields = new Set([
    'id',
    'name',
    'display_name',
    'description',
    'author',
    'homepage',
    'icon',
    'dxt_version',
    'version',
    'server',
    'tools',
    'prompts',
    'resources',
    'user_config',
    'tools_generated',
    'prompts_generated',
    'compatibility',
    'source',
    'documentation',
    'support',
    'long_description',
    'repository',
    'screenshots',
    'keywords',
    'license',
    '$schema',
  ]);

  const filtered: any = {};
  for (const [key, value] of Object.entries(cleaned)) {
    if (allowedFields.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

function isValidUrl(url: any): boolean {
  if (typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function cleanUserConfig(userConfig: any): any {
  if (typeof userConfig !== 'object' || !userConfig) return {};

  const cleaned: any = {};
  for (const [key, value] of Object.entries(userConfig)) {
    if (typeof value === 'object' && value !== null) {
      const cleanedValue: any = {
        type: (value as any).type || 'string',
        title: (value as any).title || key,
        description: (value as any).description || `Configuration for ${key}`,
        default: (value as any).default,
        required: (value as any).required,
        multiple: (value as any).multiple,
        sensitive: (value as any).sensitive,
        min: (value as any).min,
        max: (value as any).max,
      };

      Object.keys(cleanedValue).forEach((k) => {
        if (cleanedValue[k] === undefined) {
          delete cleanedValue[k];
        }
      });

      cleaned[key] = cleanedValue;
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

function parseManifests(raw: any[]): z.infer<typeof DxtManifestSchema>[] {
  const normalized = raw.map((manifest, index) => normalizeManifest(manifest, index));
  const valid: z.infer<typeof DxtManifestSchema>[] = [];

  normalized.forEach((manifest, index) => {
    try {
      valid.push(DxtManifestSchema.parse(manifest));
    } catch (err) {
      console.warn(`Skipping invalid manifest at index ${index}:`, err, manifest);
    }
  });

  return valid;
}

export function useDxt(refreshTrigger?: number) {
  const [dxtList, setDxtList] = useState<z.infer<typeof DxtManifestSchema>[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadManifests() {
    try {
      const result = (await loadDxtManifests()) as any[];
      const valid = parseManifests(result);

      console.log(`Successfully loaded ${valid.length} out of ${result.length} manifests`);

      if (valid.length === 0 && result.length > 0) {
        console.error('All manifests failed validation. This might indicate a schema mismatch.');
        console.log('Sample raw manifest:', result[0]);
      }

      setDxtList(valid);
    } catch (err) {
      console.error('Failed to load manifests:', err);
      setDxtList([]);
    } finally {
      setLoading(false);
    }
  }

  async function initializeManifests() {
    setLoading(true);
    try {
      const manifestsExist = await checkManifestsExist();
      if (!manifestsExist) {
        console.log('No manifests found locally, downloading...');
        await downloadAndExtractManifests();
      }
      await loadManifests();
    } catch (err) {
      console.error('Failed to initialize manifests:', err);
      setDxtList([]);
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (search.trim() === '') {
      await loadManifests();
    } else {
      try {
        const result = (await loadDxtManifests()) as any[];
        const filtered = result.filter(
          (manifest) =>
            manifest.name?.toLowerCase().includes(search.toLowerCase()) ||
            manifest.display_name?.toLowerCase().includes(search.toLowerCase()) ||
            manifest.description?.toLowerCase().includes(search.toLowerCase())
        );
        setDxtList(parseManifests(filtered));
      } catch (err) {
        console.error('Failed to search manifests:', err);
      }
    }
  }

  useEffect(() => {
    void initializeManifests();
  }, []);

  useEffect(() => {
    if (refreshTrigger) void initializeManifests();
  }, [refreshTrigger]);

  return { dxtList, search, setSearch, loading, handleSearch };
}
