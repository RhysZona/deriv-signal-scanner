import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DigitStats, StrategyConfig } from './types.ts';

// ── Mock getConfig ──────────────────────────────────────────────────────────

const DEFAULT_CFG: StrategyConfig = {
  quietThreshold: 9.8,
  excludeDigits: [0, 9],
  oppositeThreshold: 10.1,
  dominantThreshold: 10.7,
  lookbackTicks: 1000,
  scanIntervalMs: 30_000,
  marketRefreshMs: 3_600_000,
  configPollMs: 15_000,
  livePollIntervalMs: 2_000,
  livePollCount: 100,
};

let mockCfg = { ...DEFAULT_CFG };

vi.mock('./config.ts', () => ({
  getConfig: () => mockCfg,
}));

// Import after mock setup
const { analyzeMarket, trackEntryTick, rankSignals, analyzeFrequencies, getLastDigit } = await import('./analyzer.ts');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a price array that produces a specific digit distribution.
 * Each entry in `dist` maps a digit (0-9) to its desired percentage.
 * Total ticks = 1000.
 */
function pricesFromDistribution(dist: Record<number, number>): number[] {
  const total = 1000;
  const prices: number[] = [];
  for (const [digit, pct] of Object.entries(dist)) {
    const count = Math.round((pct / 100) * total);
    for (let i = 0; i < count; i++) {
      // Price ending in the target digit at 2 decimal places
      prices.push(parseFloat(`100.0${digit}`));
    }
  }
  return prices;
}

/**
 * Build DigitStats[] directly from a percentage map.
 */
function digitStatsFrom(dist: Record<number, number>): DigitStats[] {
  return Array.from({ length: 10 }, (_, d) => ({
    digit: d,
    count: Math.round((dist[d] ?? 0) * 10),
    percentage: dist[d] ?? 0,
  }));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('getLastDigit', () => {
  it('extracts the last digit with correct precision', () => {
    expect(getLastDigit(1234.50, 2)).toBe(0);
    expect(getLastDigit(1234.57, 2)).toBe(7);
    expect(getLastDigit(1234.5, 2)).toBe(0); // toFixed(2) → "1234.50"
    expect(getLastDigit(123.456, 3)).toBe(6);
    expect(getLastDigit(100.05, 2)).toBe(5);
  });
});

describe('analyzeFrequencies', () => {
  it('computes correct digit percentages', () => {
    // 10 prices: one of each digit 0-9
    const prices = [100.00, 100.01, 100.02, 100.03, 100.04, 100.05, 100.06, 100.07, 100.08, 100.09];
    const result = analyzeFrequencies(prices, 2);
    expect(result).toHaveLength(10);
    for (const d of result) {
      expect(d.percentage).toBe(10.0);
    }
  });
});

describe('Even/Odd strategy — analyzeMarket', () => {
  beforeEach(() => {
    mockCfg = { ...DEFAULT_CFG };
  });

  describe('EVEN filter', () => {
    it('passes when all odd digits ≤ 10.1%, top 2 are even ≥ 10.7%, bottom 2 are odd', () => {
      // Craft: odd digits all ≤ 10.1%, even digits dominant
      const dist: Record<number, number> = {
        0: 11.0, 1: 9.0, 2: 12.0, 3: 8.0,
        4: 11.5, 5: 9.5, 6: 10.5, 7: 8.5,
        8: 10.0, 9: 10.0,
      };
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const even = results.find(r => r.tradeType === 'EVEN')!;

      expect(even.passesFilter).toBe(true);
      expect(even.status).toBe('watching_entry');
      expect(even.quietDigits.length).toBeGreaterThan(0); // returns all digits
    });

    it('fails when an odd digit exceeds oppositeThreshold', () => {
      const dist: Record<number, number> = {
        0: 11.0, 1: 11.0, 2: 12.0, 3: 8.0,
        4: 11.5, 5: 9.5, 6: 10.5, 7: 8.5,
        8: 10.0, 9: 8.5,
      };
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const even = results.find(r => r.tradeType === 'EVEN')!;

      expect(even.passesFilter).toBe(false);
      expect(even.status).toBe('pending');
    });

    it('fails when #1 most appearing digit is odd', () => {
      // Odd digit 5 is the most appearing
      const dist: Record<number, number> = {
        0: 10.0, 1: 9.0, 2: 10.0, 3: 9.0,
        4: 10.0, 5: 12.0, 6: 10.0, 7: 10.0,
        8: 10.0, 9: 10.0,
      };
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const even = results.find(r => r.tradeType === 'EVEN')!;

      expect(even.passesFilter).toBe(false);
    });

    it('fails when bottom 2 digits span parities and fewer than 3 even digits ≥ dominantThreshold', () => {
      // Bottom 2 are 4 (even) and 7 (odd) — span parities
      // Only 2 even digits at 10.7% — need 3+
      const dist: Record<number, number> = {
        0: 9.5, 1: 9.0, 2: 11.0, 3: 9.0,
        4: 8.0, 5: 10.0, 6: 11.0, 7: 8.5,
        8: 10.0, 9: 10.0,
      };
      // Even digits ≥ 10.7%: 2 (11.0), 6 (11.0) → only 2
      // Bottom 2: 4 (8.0, even) and 7 (8.5, odd) → span parities
      // Fallback needs 3+ even ≥ 10.7 → fails
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const even = results.find(r => r.tradeType === 'EVEN')!;

      expect(even.passesFilter).toBe(false);
    });

    it('passes fallback when bottom 2 span parities but 3+ even digits ≥ dominantThreshold', () => {
      // Bottom 2 span parities: 4(even,7) and 7(odd,8)
      // 3 even digits ≥ 10.7%: 0(13), 2(13), 6(12), 8(11)
      const dist: Record<number, number> = {
        0: 13, 1: 8, 2: 13, 3: 8, 4: 7, 5: 10, 6: 12, 7: 8, 8: 11, 9: 10,
      };
      // Odd ≤ 10.1%: 1=8, 3=8, 5=10, 7=8, 9=10 ✓
      // Top 2: 0(even,13), 2(even,13) ✓
      // Bottom 2: 4(even,7), 7(odd,8) → span parities
      // Fallback: even ≥ 10.7%: 0,2,6,8 = 4 → passes
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const even = results.find(r => r.tradeType === 'EVEN')!;

      expect(even.passesFilter).toBe(true);
    });
  });

  describe('ODD filter', () => {
    it('passes when all even digits ≤ 10.1%, top 2 are odd ≥ 10.7%, bottom 2 are even', () => {
      const dist: Record<number, number> = {
        0: 9.0, 1: 11.5, 2: 9.0, 3: 12.0,
        4: 8.5, 5: 10.5, 6: 9.5, 7: 11.0,
        8: 9.0, 9: 10.0,
      };
      // Even ≤ 10.1%: 0(9), 2(9), 4(8.5), 6(9.5), 8(9) ✓
      // Top 2: 3(12.0 odd), 1(11.5 odd) ✓
      // Bottom 2: 4(8.5 even), 2(9.0 even) ✓
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const odd = results.find(r => r.tradeType === 'ODD')!;

      expect(odd.passesFilter).toBe(true);
      expect(odd.status).toBe('watching_entry');
    });

    it('fails when an even digit exceeds oppositeThreshold', () => {
      const dist: Record<number, number> = {
        0: 11.0, 1: 11.5, 2: 9.0, 3: 12.0,
        4: 8.5, 5: 10.5, 6: 9.5, 7: 11.0,
        8: 9.0, 9: 10.0,
      };
      // 0 = 11.0% > 10.1% → fails
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const odd = results.find(r => r.tradeType === 'ODD')!;

      expect(odd.passesFilter).toBe(false);
    });
  });

  describe('EVEN entry digit', () => {
    it('selects the least appearing odd digit', () => {
      // Odd digits: 1=8.0, 3=9.0, 5=9.5, 7=7.5, 9=10.0
      // Entry should be 7 (7.5% — least appearing odd)
      const dist: Record<number, number> = {
        0: 11.0, 1: 8.0, 2: 12.0, 3: 9.0,
        4: 11.5, 5: 9.5, 6: 10.5, 7: 7.5,
        8: 10.0, 9: 10.0,
      };
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const even = results.find(r => r.tradeType === 'EVEN')!;

      expect(even.passesFilter).toBe(true);
      expect(even.entryDigit).toBe(7);
    });
  });

  describe('ODD entry digit', () => {
    it('selects the least appearing even digit', () => {
      // Even digits: 0=10.0, 2=8.0, 4=9.0, 6=9.5, 8=8.5
      // Entry should be 2 (8.0% — least appearing even)
      const dist: Record<number, number> = {
        0: 10.0, 1: 11.5, 2: 8.0, 3: 12.0,
        4: 9.0, 5: 10.5, 6: 9.5, 7: 11.0,
        8: 8.5, 9: 10.0,
      };
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const odd = results.find(r => r.tradeType === 'ODD')!;

      expect(odd.passesFilter).toBe(true);
      expect(odd.entryDigit).toBe(2);
    });
  });

  describe('EVEN confirmation', () => {
    it('lists all even digits except the 2nd-most appearing', () => {
      // Sorted by %: 2=12.0(#1), 4=11.5(#2), 0=11.0(#3), ...
      // 2nd-most = 4, so confirmation = [0, 2, 6, 8]
      const dist: Record<number, number> = {
        0: 11.0, 1: 9.0, 2: 12.0, 3: 8.0,
        4: 11.5, 5: 9.5, 6: 10.5, 7: 8.5,
        8: 10.0, 9: 10.0,
      };
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const even = results.find(r => r.tradeType === 'EVEN')!;

      expect(even.passesFilter).toBe(true);
      expect(even.validConfirmationDigits).toEqual([0, 2, 6, 8]);
      expect(even.confirmationText).toBe('Any even digit (except the 2nd-most appearing digit)');
    });
  });

  describe('ODD confirmation', () => {
    it('returns the temporal confirmation text', () => {
      const dist: Record<number, number> = {
        0: 9.0, 1: 11.5, 2: 9.0, 3: 12.0,
        4: 8.5, 5: 10.5, 6: 9.5, 7: 11.0,
        8: 9.0, 9: 10.0,
      };
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Volatility 100', 'Volatility', prices, 2);
      const odd = results.find(r => r.tradeType === 'ODD')!;

      expect(odd.passesFilter).toBe(true);
      expect(odd.confirmationText).toBe('Two consecutive odd digits within 6 ticks');
    });
  });

  describe('EVEN scoring', () => {
    it('scores higher when dominant digits are stronger', () => {
      // Strong even: top 2 avg = 14.5
      const distStrong: Record<number, number> = {
        0: 15, 1: 7, 2: 14, 3: 7, 4: 8, 5: 10, 6: 11, 7: 8, 8: 10, 9: 10,
      };
      // Weak even: top 2 avg = 11.5
      const distWeak: Record<number, number> = {
        0: 12, 1: 9, 2: 11, 3: 9, 4: 10, 5: 10, 6: 10, 7: 9, 8: 10, 9: 10,
      };

      const pricesStrong = pricesFromDistribution(distStrong);
      const pricesWeak = pricesFromDistribution(distWeak);

      const resultsStrong = analyzeMarket('R_100', 'Vol 100', 'Volatility', pricesStrong, 2);
      const resultsWeak = analyzeMarket('R_100', 'Vol 100', 'Volatility', pricesWeak, 2);

      const evenStrong = resultsStrong.find(r => r.tradeType === 'EVEN')!;
      const evenWeak = resultsWeak.find(r => r.tradeType === 'EVEN')!;

      expect(evenStrong.passesFilter).toBe(true);
      expect(evenWeak.passesFilter).toBe(true);
      expect(evenStrong.quietScore).toBeGreaterThan(evenWeak.quietScore);
    });

    it('adds bonus for each extra dominant digit above threshold beyond 2', () => {
      // 3 even digits ≥ 10.7%: 0=13, 2=12, 4=12 → bonus = 1 × 0.5 = 0.5
      const dist3: Record<number, number> = {
        0: 13, 1: 8, 2: 12, 3: 8, 4: 12, 5: 10, 6: 9, 7: 8, 8: 10, 9: 10,
      };
      // 2 even digits ≥ 10.7%: 0=12, 2=11 → bonus = 0
      const dist2: Record<number, number> = {
        0: 12, 1: 9, 2: 11, 3: 9, 4: 10, 5: 10, 6: 10, 7: 9, 8: 10, 9: 10,
      };

      const prices3 = pricesFromDistribution(dist3);
      const prices2 = pricesFromDistribution(dist2);

      const results3 = analyzeMarket('R_100', 'Vol 100', 'Volatility', prices3, 2);
      const results2 = analyzeMarket('R_100', 'Vol 100', 'Volatility', prices2, 2);

      const even3 = results3.find(r => r.tradeType === 'EVEN')!;
      const even2 = results2.find(r => r.tradeType === 'EVEN')!;

      expect(even3.passesFilter).toBe(true);
      expect(even2.passesFilter).toBe(true);
      // even3 should score ~0.5 higher due to the bonus
      expect(even3.quietScore).toBeGreaterThan(even2.quietScore);
    });
  });

  describe('Over/Under still works', () => {
    it('OVER_3 passes when digits 0-3 are all ≤ quietThreshold', () => {
      const dist: Record<number, number> = {
        0: 7.0, 1: 7.5, 2: 8.0, 3: 8.5,
        4: 12.0, 5: 11.5, 6: 11.0, 7: 10.5,
        8: 12.0, 9: 12.0,
      };
      const prices = pricesFromDistribution(dist);
      const results = analyzeMarket('R_100', 'Vol 100', 'Volatility', prices, 2);
      const over3 = results.find(r => r.tradeType === 'OVER_3')!;

      expect(over3.passesFilter).toBe(true);
      expect(over3.entryDigit).toBe(1); // least appearing quiet digit, excluding 0 and 9
      expect(over3.quietDigits).toHaveLength(4);
      expect(over3.confirmationText).toBe('');
    });
  });
});

describe('trackEntryTick', () => {
  it('sets entryTriggered when entry digit matches', () => {
    const setup = {
      tradeType: 'EVEN' as const,
      marketSymbol: 'R_100',
      marketDisplayName: 'Volatility 100',
      market: 'Volatility',
      passesFilter: true,
      allDigits: [],
      quietDigits: [],
      entryDigit: 5,
      validConfirmationDigits: [0, 2, 4, 6, 8],
      confirmationText: 'Any even digit (except the 2nd-most appearing digit)',
      quietScore: 11.0,
      status: 'watching_entry' as const,
      entryTriggered: false,
      entryTriggeredAt: null,
    };

    const result = trackEntryTick(setup, 5);
    expect(result.entryTriggered).toBe(true);
    expect(result.entryTriggeredAt).toBeTypeOf('number');
  });

  it('does not trigger when entry digit does not match', () => {
    const setup = {
      tradeType: 'EVEN' as const,
      marketSymbol: 'R_100',
      marketDisplayName: 'Volatility 100',
      market: 'Volatility',
      passesFilter: true,
      allDigits: [],
      quietDigits: [],
      entryDigit: 5,
      validConfirmationDigits: [0, 2, 4, 6, 8],
      confirmationText: '',
      quietScore: 11.0,
      status: 'watching_entry' as const,
      entryTriggered: false,
      entryTriggeredAt: null,
    };

    const result = trackEntryTick(setup, 3);
    expect(result.entryTriggered).toBe(false);
    expect(result.entryTriggeredAt).toBeNull();
  });

  it('does nothing when status is pending', () => {
    const setup = {
      tradeType: 'ODD' as const,
      marketSymbol: 'R_100',
      marketDisplayName: 'Volatility 100',
      market: 'Volatility',
      passesFilter: false,
      allDigits: [],
      quietDigits: [],
      entryDigit: null,
      validConfirmationDigits: [],
      confirmationText: '',
      quietScore: 0,
      status: 'pending' as const,
      entryTriggered: false,
      entryTriggeredAt: null,
    };

    const result = trackEntryTick(setup, 5);
    expect(result).toBe(setup); // no mutation
  });
});

describe('rankSignals', () => {
  it('ranks EVEN/ODD signals at high tier alongside OVER_3/UNDER_6', () => {
    const base = {
      marketSymbol: 'R_100',
      marketDisplayName: 'Volatility 100',
      market: 'Volatility',
      passesFilter: true,
      allDigits: [],
      quietDigits: [],
      entryDigit: 5,
      validConfirmationDigits: [],
      confirmationText: '',
      status: 'watching_entry' as const,
      entryTriggered: false,
      entryTriggeredAt: null,
    };

    const results = [
      { ...base, tradeType: 'OVER_2' as const, quietScore: 5.0 },
      { ...base, tradeType: 'EVEN' as const, quietScore: 11.0 },
      { ...base, tradeType: 'OVER_3' as const, quietScore: 2.0 },
      { ...base, tradeType: 'ODD' as const, quietScore: 12.0 },
      { ...base, tradeType: 'UNDER_6' as const, quietScore: 3.0 },
    ];

    const ranked = rankSignals(results);      // High tier first: sorted by score desc within tier
      expect(ranked[0].tradeType).toBe('ODD');    // score 12.0
      expect(ranked[1].tradeType).toBe('EVEN');   // score 11.0
      expect(ranked[2].tradeType).toBe('UNDER_6');// score 3.0
      expect(ranked[3].tradeType).toBe('OVER_3'); // score 2.0
      expect(ranked[4].tradeType).toBe('OVER_2'); // medium tier
  });

  it('excludes signals with null entryDigit', () => {
    const results = [
      {
        tradeType: 'EVEN' as const,
        marketSymbol: 'R_100',
        marketDisplayName: 'Volatility 100',
        market: 'Volatility',
        passesFilter: true,
        allDigits: [],
        quietDigits: [],
        entryDigit: null,
        validConfirmationDigits: [],
        confirmationText: '',
        quietScore: 11.0,
        status: 'pending' as const,
        entryTriggered: false,
        entryTriggeredAt: null,
      },
    ];

    const ranked = rankSignals(results);
    expect(ranked).toHaveLength(0);
  });
});
