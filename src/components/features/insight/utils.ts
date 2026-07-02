import type { TokenStats } from '@/services/tauri/insights';
import type { AgentKey, ModelPricing, Range } from './constants';

/** Default pricing per 1M tokens (USD).
 *  Keys are lowercase substrings matched against model names (most specific first). */
export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  // ── Claude ────────────────────────────────────────────────────────────────
  'claude-opus-4': { input: 15.0, output: 75.0, cache_read: 1.5, cache_creation: 18.75 },
  'claude-sonnet-4': { input: 3.0, output: 15.0, cache_read: 0.3, cache_creation: 3.75 },
  'claude-haiku-4': { input: 0.8, output: 4.0, cache_read: 0.08, cache_creation: 1.0 },
  // ── GPT-5 Codex variants (most specific first) ────────────────────────────
  'gpt-5.1-codex-max': { input: 6.0, output: 24.0, cache_read: 1.5, cache_creation: 0 },
  'gpt-5.3-codex': { input: 5.0, output: 20.0, cache_read: 1.25, cache_creation: 0 },
  'gpt-5.2-codex': { input: 4.0, output: 16.0, cache_read: 1.0, cache_creation: 0 },
  'gpt-5.1-codex-mini': { input: 1.1, output: 4.4, cache_read: 0.275, cache_creation: 0 },
  'gpt-5-codex-mini': { input: 1.1, output: 4.4, cache_read: 0.275, cache_creation: 0 },
  'gpt-5-codex': { input: 3.0, output: 12.0, cache_read: 0.75, cache_creation: 0 },
  'gpt-5.1-codex': { input: 3.5, output: 14.0, cache_read: 0.875, cache_creation: 0 },
  // ── GPT-5 base variants ───────────────────────────────────────────────────
  'gpt-5.4': { input: 5.0, output: 20.0, cache_read: 0.5, cache_creation: 0 },
  'gpt-5.2': { input: 3.5, output: 14.0, cache_read: 0.35, cache_creation: 0 },
  'gpt-5.1': { input: 3.0, output: 12.0, cache_read: 0.3, cache_creation: 0 },
  'gpt-5': { input: 2.5, output: 10.0, cache_read: 0.25, cache_creation: 0 },
  // gemini
  'gemini-3-flash-preview': { input: 0.5, output: 3.0, cache_read: 0.05, cache_creation: 0 },
  'gemini-3-pro-preview': { input: 2.0, output: 12.0, cache_read: 0.2, cache_creation: 0 },
  // ── fallback per-agent defaults (used when model is unknown) ──────────────
  _claude_fallback: { input: 3.0, output: 15.0, cache_read: 0.3, cache_creation: 3.75 },
  _codex_fallback: { input: 2.5, output: 10.0, cache_read: 0.625, cache_creation: 0 },
  _gemini_fallback: { input: 0.075, output: 0.3, cache_read: 0.01875, cache_creation: 0.1875 },
};

export const PRICING_LS_KEY = 'insights_model_pricing';

export function loadPricing(): Record<string, ModelPricing> {
  try {
    const s = localStorage.getItem(PRICING_LS_KEY);
    if (s) return { ...DEFAULT_MODEL_PRICING, ...JSON.parse(s) };
  } catch {}
  return { ...DEFAULT_MODEL_PRICING };
}

export function savePricing(p: Record<string, ModelPricing>) {
  const overrides: Record<string, ModelPricing> = {};
  for (const [k, v] of Object.entries(p)) {
    const def = DEFAULT_MODEL_PRICING[k];
    if (!def || JSON.stringify(def) !== JSON.stringify(v)) overrides[k] = v;
  }
  localStorage.setItem(PRICING_LS_KEY, JSON.stringify(overrides));
}

export function pricingForModel(
  model: string | undefined,
  agent: AgentKey,
  pricing: Record<string, ModelPricing>
): ModelPricing {
  if (model) {
    const lower = model.toLowerCase();
    for (const key of Object.keys(pricing)) {
      if (!key.startsWith('_') && lower.includes(key)) return pricing[key];
    }
  }
  return pricing[`_${agent}_fallback`] ?? { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
}

export function estimateCost(
  stats: TokenStats,
  models: string[],
  agent: AgentKey,
  pricing: Record<string, ModelPricing>
): number {
  const p = pricingForModel(models[0], agent, pricing);
  return (
    (stats.input_tokens / 1_000_000) * p.input +
    (stats.output_tokens / 1_000_000) * p.output +
    (stats.cache_read_tokens / 1_000_000) * p.cache_read +
    (stats.cache_creation_tokens / 1_000_000) * p.cache_creation
  );
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return '< $0.01';
  return `~$${usd.toFixed(2)}`;
}

export function weeksForRange(range: Range): number {
  if (range === 'day') return 2;
  if (range === 'week') return 3;
  if (range === 'month') return 6;
  if (range === 'year') return 26;
  return 53;
}
