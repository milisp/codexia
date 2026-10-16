import type { ThreadUsage } from '@/bindings/v2';

const MICROS = 1_000_000;

/** The wire format is JSON, so values arrive as numbers even though bindings declare bigint. */
export type Micros = bigint | number;

/** Convert micro-units to whole units without overflowing Number for large bigint values. */
export function microsToUnits(value: Micros): number {
  if (typeof value === 'bigint') {
    const whole = value / BigInt(MICROS);
    const frac = value % BigInt(MICROS);
    return Number(whole) + Number(frac) / MICROS;
  }
  return value / MICROS;
}

/** Format USD micros as an estimate, e.g. "$1.23"; sub-cent amounts collapse to "<$0.01". */
export function formatUsdMicros(value: Micros): string {
  const usd = microsToUnits(value);
  if (usd <= 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

/** Format credit micros, e.g. "1.25 credits". */
export function formatCreditsMicros(value: Micros): string {
  const credits = microsToUnits(value);
  if (credits <= 0) return '0 credits';
  if (credits < 0.01) return '<0.01 credits';
  return `${credits.toFixed(2)} credits`;
}

/** Headline cost: USD when the server priced it, credits otherwise. Null when there is nothing to show. */
export function formatThreadCost(usage: ThreadUsage | null | undefined): string | null {
  if (!usage) return null;
  const usd = usage.estimatedUsageUsdMicros;
  if (usd !== null && usd !== undefined) {
    if (microsToUnits(usd) <= 0 && usage.groups.length === 0) return null;
    return formatUsdMicros(usd);
  }
  if (microsToUnits(usage.estimatedUsageCreditsMicros) <= 0 && usage.groups.length === 0) {
    return null;
  }
  return formatCreditsMicros(usage.estimatedUsageCreditsMicros);
}

/** Label for one breakdown row, e.g. "gpt-5 (high)". */
export function groupLabel(group: ThreadUsage['groups'][number]): string {
  const model = group.model ?? 'Unknown model';
  return group.reasoningEffort ? `${model} (${group.reasoningEffort})` : model;
}
