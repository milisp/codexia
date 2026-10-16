import { useEffect, useState } from 'react';
import type { PluginSearchResult } from '@/bindings/v2';
import { pluginSearch } from '@/services';

export const PLUGIN_SEARCH_DEBOUNCE_MS = 300;
const PLUGIN_SEARCH_LIMIT = 100;

/**
 * Server-side `plugin/search` for the search box.
 *
 * Unlike `plugin/list`, it also covers the hosted remote catalog and returns
 * results ranked by relevance. Returns `null` while there is no settled answer
 * for the current query (empty query, debounce pending, request in flight, or
 * request failed) so callers keep filtering the local list as a fallback.
 * Responses for an older query are discarded.
 */
export function usePluginSearch(query: string): PluginSearchResult[] | null {
  const term = query.trim();
  const [settled, setSettled] = useState<{
    term: string;
    results: PluginSearchResult[];
  } | null>(null);

  useEffect(() => {
    if (!term) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      pluginSearch({ searchTerm: term, limit: PLUGIN_SEARCH_LIMIT })
        .then((response) => {
          if (!cancelled) setSettled({ term, results: response.data });
        })
        .catch((error) => {
          console.warn('plugin/search failed, using the local filter:', error);
          if (!cancelled) setSettled(null);
        });
    }, PLUGIN_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  return term && settled?.term === term ? settled.results : null;
}
