import { DigitStats, TradeSetup, TradeType, TradeStatus } from './types.ts';
import { getConfig } from './config.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the last digit (0-9) from a numeric price value at the given decimal
 * precision.
 *
 * Deriv synthetic-index prices quote at market-specific precision (2–4+
 * decimals). `toFixed(decimals)` preserves trailing zeros that `.toString()`
 * would drop (e.g. 1234.50 → "1234.50", not "1234.5"), and — crucially — uses
 * the *correct* number of decimals for the market so the "last digit" is the
 * digit Deriv's contracts actually settle on.
 */
export function getLastDigit(price: number, decimals: number): number {
  const str = price.toFixed(decimals);
  return str.charCodeAt(str.length - 1) - 48; // last char is always a digit here
}

/** Number of decimals actually present in a raw price value. */
export function observedDecimals(price: number): number {
  if (!Number.isFinite(price)) return 0;
  const s = String(price);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/** Compute frequency of each digit (0-9) from an array of price ticks */
export function analyzeFrequencies(prices: number[], decimals: number): DigitStats[] {
  const counts = new Array(10).fill(0);
  const total = prices.length;

  for (const price of prices) {
    counts[getLastDigit(price, decimals)]++;
  }

  return counts.map((count, digit) => ({
    digit,
    count,
    percentage: total > 0 ? +(count / total * 100).toFixed(2) : 0,
  }));
}

// ─── Trade Type Configurations ──────────────────────────────────────────────

export type PayoutTier = 'high' | 'medium';

interface TradeTypeConfig {
  type: TradeType;
  label: string;
  quietDigits: number[];
  /** Given a candidate digit, does it confirm the trade? */
  confirmCondition: (d: number) => boolean;
  payoutTier: PayoutTier;
}

export const TRADE_CONFIGS: TradeTypeConfig[] = [
  {
    type: 'OVER_3',
    label: 'Over 3',
    quietDigits: [0, 1, 2, 3],
    confirmCondition: (d) => d > 3,
    payoutTier: 'high',
  },
  {
    type: 'UNDER_6',
    label: 'Under 6',
    quietDigits: [6, 7, 8, 9],
    confirmCondition: (d) => d < 6,
    payoutTier: 'high',
  },
  {
    type: 'OVER_2',
    label: 'Over 2',
    quietDigits: [0, 1, 2],
    confirmCondition: (d) => d > 2,
    payoutTier: 'medium',
  },
  {
    type: 'UNDER_7',
    label: 'Under 7',
    quietDigits: [7, 8, 9],
    confirmCondition: (d) => d < 7,
    payoutTier: 'medium',
  },
];

// ─── Step 1: Filter ─────────────────────────────────────────────────────────

/** Return the digit stats at or below the configured quiet threshold */
function checkFilter(digits: DigitStats[], requiredDigits: number[]): DigitStats[] {
  const { quietThreshold } = getConfig();
  const quiet: DigitStats[] = [];
  for (const req of requiredDigits) {
    const stat = digits.find(d => d.digit === req);
    if (stat && stat.percentage <= quietThreshold) {
      quiet.push(stat);
    }
  }
  return quiet;
}

// ─── Step 2: Entry Digit ────────────────────────────────────────────────────

/** Pick the least frequent digit from quietDigits, excluding configured digits */
function selectEntryDigit(quietDigits: DigitStats[]): number | null {
  const { excludeDigits } = getConfig();
  const eligible = quietDigits
    .filter(d => !excludeDigits.includes(d.digit))
    .sort((a, b) => a.percentage - b.percentage);

  return eligible.length > 0 ? eligible[0].digit : null;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/** Average distance below the quiet threshold – higher = quieter = stronger signal */
function calculateQuietScore(quietDigits: DigitStats[]): number {
  if (quietDigits.length === 0) return 0;
  const { quietThreshold } = getConfig();
  const total = quietDigits.reduce((sum, d) => sum + Math.max(0, quietThreshold - d.percentage), 0);
  return +(total / quietDigits.length).toFixed(2);
}

// ─── Confirmation Digits ────────────────────────────────────────────────────

function getValidConfirmationDigits(config: TradeTypeConfig): number[] {
  const { excludeDigits } = getConfig();
  const valid: number[] = [];
  for (let d = 0; d <= 9; d++) {
    if (excludeDigits.includes(d)) continue;
    if (config.confirmCondition(d)) valid.push(d);
  }
  return valid;
}

// ─── Market Analysis ────────────────────────────────────────────────────────

/** Run the full strategy analysis on a single market */
export function analyzeMarket(
  symbol: string,
  displayName: string,
  market: string,
  prices: number[],
  decimals: number,
): TradeSetup[] {
  const digits = analyzeFrequencies(prices, decimals);

  return TRADE_CONFIGS.map((config) => {
    const quietDigits = checkFilter(digits, config.quietDigits);
    const passesFilter = quietDigits.length === config.quietDigits.length;

    let entryDigit: number | null = null;
    let quietScore = 0;
    let validConfirmationDigits: number[] = [];

    if (passesFilter) {
      entryDigit = selectEntryDigit(quietDigits);
      quietScore = calculateQuietScore(quietDigits);
      validConfirmationDigits = getValidConfirmationDigits(config);
    }

    const status: TradeStatus = passesFilter ? 'watching_entry' : 'pending';

    // If all quiet digits are 0/9 and exempt, entryDigit is null → signal can't trade
    const effectiveStatus: TradeStatus = (passesFilter && entryDigit !== null)
      ? 'watching_entry'
      : 'pending';

    return {
      tradeType: config.type,
      marketSymbol: symbol,
      marketDisplayName: displayName,
      market,
      passesFilter,
      allDigits: digits,
      quietDigits,
      entryDigit,
      quietScore: passesFilter ? quietScore : 0,
      validConfirmationDigits: passesFilter ? validConfirmationDigits : [],
      confirmationDigit: null,
      status: effectiveStatus,
      entryTriggered: false,
      ticksSinceEntry: 0,
      confirmed: false,
      confirmedAt: null,
    };
  });
}

// ─── Live Confirmation Check ────────────────────────────────────────────────

export function checkConfirmation(setup: TradeSetup, tickDigit: number): TradeSetup {
  const next = { ...setup };
  const { confirmWithinTicks, confirmedCooldownMs } = getConfig();

  switch (setup.status) {
    case 'watching_entry':
      if (tickDigit === setup.entryDigit) {
        next.status = 'watching_confirmation';
        next.entryTriggered = true;
        next.ticksSinceEntry = 0;
      }
      break;

    case 'watching_confirmation':
      next.ticksSinceEntry = setup.ticksSinceEntry + 1;

      if (setup.validConfirmationDigits.includes(tickDigit)) {
        next.status = 'confirmed';
        next.confirmed = true;
        next.confirmationDigit = tickDigit;
        next.confirmedAt = Date.now();
      } else if (next.ticksSinceEntry >= confirmWithinTicks) {
        // Failed to confirm within the window → reset
        next.status = 'watching_entry';
        next.entryTriggered = false;
        next.ticksSinceEntry = 0;
      }
      break;

    case 'confirmed':
      // Auto-reset a stale confirmation so old cards don't linger forever.
      if (setup.confirmedAt && Date.now() - setup.confirmedAt >= confirmedCooldownMs) {
        next.status = 'watching_entry';
        next.confirmed = false;
        next.confirmedAt = null;
        next.confirmationDigit = null;
        next.entryTriggered = false;
        next.ticksSinceEntry = 0;
      }
      break;

    default:
      break;
  }

  return next;
}

// ─── Ranking ────────────────────────────────────────────────────────────────

/** Rank tradable signals: high-payout tier first, then by quiet score descending */
export function rankSignals(results: TradeSetup[]): TradeSetup[] {
  return results
    // Only rank signals that actually have a usable entry digit.
    .filter(r => r.passesFilter && r.entryDigit !== null)
    .sort((a, b) => {
      const configA = TRADE_CONFIGS.find(c => c.type === a.tradeType)!;
      const configB = TRADE_CONFIGS.find(c => c.type === b.tradeType)!;

      // High payout tier first
      if (configA.payoutTier !== configB.payoutTier) {
        return configA.payoutTier === 'high' ? -1 : 1;
      }

      // Within same tier, higher quiet score = better (quieter digits)
      return b.quietScore - a.quietScore;
    });
}
