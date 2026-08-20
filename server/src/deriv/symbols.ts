/**
 * Market symbol definitions.
 *
 * The list is no longer hardcoded — it is discovered at runtime from Deriv's
 * `active_symbols` API (see marketDiscovery.ts) so it always covers every
 * Volatility (plain + 1s) and Jump index, and never goes stale when Deriv
 * adds, renames, or suspends a market.
 *
 * A small static fallback is kept so the app can still function if the very
 * first discovery call fails (e.g. transient network error at startup).
 */

export type MarketFamily = 'Volatility' | 'Jump';

export interface MarketSymbol {
  symbol: string;
  displayName: string;
  market: MarketFamily;
  /**
   * Number of decimal places in this market's quotes. Critical for last-digit
   * analysis — different synthetics quote at different precision.
   */
  decimals: number;
}

/**
 * Verified market list, probed directly via `ticks_history` against the live
 * Deriv API (see debug/diagnose.ts). Used as the primary source when the
 * `active_symbols` catalog is unreachable (it is geo/infra-restricted from some
 * environments) and refreshed/extended by marketDiscovery.ts when it isn't.
 *
 * `decimals` reflects the precision actually observed in each market's quotes —
 * this is what last-digit analysis keys off, and it genuinely varies per market.
 *
 * SCOPE: this is deliberately limited to the exact markets the operator trades —
 * Volatility 10/25/50/75/100 (plain AND 1s) and Jump 10/25/50/75/100 (15 total).
 * See ALLOWED_SYMBOLS below; discovery is filtered to this same set so no other
 * market can slip in.
 *
 * IMPORTANT: the previous Jump codes (1HZ..J) were INVALID and silently returned
 * no data. The correct Jump codes are JD10/25/50/75/100 (verified live).
 */
export const FALLBACK_MARKETS: MarketSymbol[] = [
  // Volatility Indices (plain)
  { symbol: 'R_10', displayName: 'Volatility 10', market: 'Volatility', decimals: 3 },
  { symbol: 'R_25', displayName: 'Volatility 25', market: 'Volatility', decimals: 3 },
  { symbol: 'R_50', displayName: 'Volatility 50', market: 'Volatility', decimals: 4 },
  { symbol: 'R_75', displayName: 'Volatility 75', market: 'Volatility', decimals: 4 },
  { symbol: 'R_100', displayName: 'Volatility 100', market: 'Volatility', decimals: 2 },
  // Volatility Indices (1s)
  { symbol: '1HZ10V', displayName: 'Volatility 10 (1s)', market: 'Volatility', decimals: 2 },
  { symbol: '1HZ15V', displayName: 'Volatility 15 (1s)', market: 'Volatility', decimals: 3 },
  { symbol: '1HZ25V', displayName: 'Volatility 25 (1s)', market: 'Volatility', decimals: 2 },
  { symbol: '1HZ30V', displayName: 'Volatility 30 (1s)', market: 'Volatility', decimals: 3 },
  { symbol: '1HZ50V', displayName: 'Volatility 50 (1s)', market: 'Volatility', decimals: 2 },
  { symbol: '1HZ75V', displayName: 'Volatility 75 (1s)', market: 'Volatility', decimals: 2 },
  { symbol: '1HZ90V', displayName: 'Volatility 90 (1s)', market: 'Volatility', decimals: 3 },
  { symbol: '1HZ100V', displayName: 'Volatility 100 (1s)', market: 'Volatility', decimals: 2 },
  // Jump Indices (correct codes)
  { symbol: 'JD10', displayName: 'Jump 10', market: 'Jump', decimals: 2 },
  { symbol: 'JD25', displayName: 'Jump 25', market: 'Jump', decimals: 2 },
  { symbol: 'JD50', displayName: 'Jump 50', market: 'Jump', decimals: 2 },
  { symbol: 'JD75', displayName: 'Jump 75', market: 'Jump', decimals: 2 },
  { symbol: 'JD100', displayName: 'Jump 100', market: 'Jump', decimals: 2 },
];

/**
 * The ONLY symbols the scanner is allowed to cover. Discovery filters against
 * this so Deriv's full catalog (which lists many more Volatility/Jump variants)
 * can't reintroduce markets the operator doesn't trade. To add/remove a market,
 * edit this set and FALLBACK_MARKETS together.
 */
export const ALLOWED_SYMBOLS: ReadonlySet<string> = new Set(
  FALLBACK_MARKETS.map((m) => m.symbol),
);

/** Runtime cache of discovered markets. Populated by setMarkets(). */
let markets: MarketSymbol[] = [...FALLBACK_MARKETS];

export function getMarkets(): MarketSymbol[] {
  return markets;
}

export function setMarkets(next: MarketSymbol[]): void {
  if (next.length > 0) markets = next;
}

/** Update just the decimals for one symbol (used to self-correct from live ticks). */
export function setSymbolDecimals(symbol: string, decimals: number): void {
  const m = markets.find((x) => x.symbol === symbol);
  if (m) m.decimals = decimals;
}

/**
 * Permanently drop a symbol from the runtime list. Used when Deriv reports a
 * symbol as invalid for this account's region (e.g. 1HZ200V/1HZ300V may not be
 * offered in Kenya) so we stop re-requesting it every scan.
 */
export function removeSymbol(symbol: string): void {
  markets = markets.filter((x) => x.symbol !== symbol);
}

export function getSymbolDecimals(symbol: string): number | undefined {
  return markets.find((x) => x.symbol === symbol)?.decimals;
}
