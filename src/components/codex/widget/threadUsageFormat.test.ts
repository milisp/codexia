import { describe, expect, it } from 'vitest';
import type { ThreadUsage } from '@/bindings/v2';
import {
  formatCreditsMicros,
  formatThreadCost,
  formatUsdMicros,
  microsToUnits,
} from './threadUsageFormat';

function usage(partial: Partial<ThreadUsage>): ThreadUsage {
  return {
    threadId: 't',
    estimatedUsageCreditsMicros: 0n,
    estimatedUsageUsdMicros: null,
    groups: [],
    ...partial,
  };
}

describe('threadUsageFormat', () => {
  it('converts micros for number and bigint inputs', () => {
    expect(microsToUnits(1_500_000)).toBe(1.5);
    expect(microsToUnits(1_500_000n)).toBe(1.5);
    expect(microsToUnits(9_007_199_254_740_993_000_000n)).toBeGreaterThan(9e15);
  });

  it('formats USD with sub-cent collapse', () => {
    expect(formatUsdMicros(1_234_000)).toBe('$1.23');
    expect(formatUsdMicros(4_000)).toBe('<$0.01');
    expect(formatUsdMicros(0)).toBe('$0.00');
  });

  it('formats credits', () => {
    expect(formatCreditsMicros(2_500_000n)).toBe('2.50 credits');
  });

  it('prefers USD, falls back to credits, and hides when empty', () => {
    expect(formatThreadCost(usage({ estimatedUsageUsdMicros: 420_000n }))).toBe('$0.42');
    expect(formatThreadCost(usage({ estimatedUsageCreditsMicros: 3_000_000n }))).toBe(
      '3.00 credits'
    );
    expect(formatThreadCost(usage({}))).toBeNull();
    expect(formatThreadCost(null)).toBeNull();
  });
});
