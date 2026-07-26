import { derivConnection } from './connection.ts';
import {
  MarketSymbol,
  MarketFamily,
  FALLBACK_MARKETS,
  ALLOWED_SYMBOLS,
  setMarkets,
  getMarkets,
} from './symbols.ts';

/**
 * Dynamic market discovery.
 *
 * Queries Deriv's `active_symbols` (full) and selects every tradable
 * Volatility (plain + 1s) and Jump index, deriving each market's decimal
 * precision from its `pip` size. Suspended / closed symbols are skipped.
 */

interface ActiveSymbol {
  symbol: string;
  display_name: string;
  market: string;
  market_display_name?: string;
  submarket: string;
  submarket_display_name?: string;
  pip: number;
  exchange_is_open?: number;
  is_trading_suspended?: number;
}

/** pip (e.g. 0.001) → decimal places (3). Guards against bad/zero pip. */
export function pipToDecimals(pip: number): number {
  if (!Number.isFinite(pip) || pip <= 0) return 2; // safe-ish default
  const decimals = Math.round(-Math.log10(pip));
  return decimals >= 0 && decimals <= 12 ? decimals : 2;
}

/** Classify a symbol into our two families, or null if it isn't one we want. */
function classify(s: ActiveSymbol): MarketFamily | null {
  const hay = `${s.market} ${s.submarket} ${s.display_name}`.toLowerCase();
  if (hay.includes('jump')) return 'Jump';
  // Volatility indices live under the synthetic/random-index submarkets and
  // are named "Volatility N (1s) Index". Match on the name/submarket to catch
  // both the plain and 1s families without also grabbing e.g. Jump.
  if (hay.includes('volatility')) return 'Volatility';
  return null;
}

export function selectMarkets(active: ActiveSymbol[]): MarketSymbol[] {
  const out: MarketSymbol[] = [];
  for (const s of active) {
    // Only the exact markets the operator trades (see ALLOWED_SYMBOLS). Deriv's
    // full catalog carries many more Volatility/Jump variants we deliberately skip.
    if (!ALLOWED_SYMBOLS.has(s.symbol)) continue;
    const family = classify(s);
    if (!family) continue;
    if (s.is_trading_suspended) continue;
    if (s.exchange_is_open === 0) continue;
    out.push({
      symbol: s.symbol,
      displayName: s.display_name,
      market: family,
      decimals: pipToDecimals(s.pip),
    });
  }
  // Stable order: family then display name, so the dashboard is predictable.
  out.sort((a, b) =>
    a.market === b.market
      ? a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
      : a.market.localeCompare(b.market),
  );
  return out;
}

/**
 * Union the API-discovered list over the verified fallback. Discovered entries
 * win on decimals/display name; fallback entries fill gaps the API omits.
 */
function mergeWithFallback(discovered: MarketSymbol[]): MarketSymbol[] {
  const map = new Map<string, MarketSymbol>();
  for (const m of FALLBACK_MARKETS) map.set(m.symbol, m);
  for (const m of discovered) map.set(m.symbol, m);
  return [...map.values()].sort((a, b) =>
    a.market === b.market
      ? a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
      : a.market.localeCompare(b.market),
  );
}

/**
 * Fetch and cache the market list. UNION-with-fallback: whatever
 * `active_symbols` returns is merged over the verified static list, so an
 * empty or partial catalog (Deriv geo-restricts this endpoint in some envs)
 * can never silently shrink coverage below the known-good set. Never throws.
 */
export async function discoverMarkets(): Promise<MarketSymbol[]> {
  try {
    const res = await derivConnection.send({
      active_symbols: 'full',
      product_type: 'basic',
    });

    const active: ActiveSymbol[] | undefined = res?.active_symbols;
    if (!active?.length) {
      console.warn('[Discovery] active_symbols unavailable — using verified fallback');
      const merged = mergeWithFallback([]);
      setMarkets(merged);
      return merged;
    }

    const selected = selectMarkets(active);
    const merged = mergeWithFallback(selected);
    setMarkets(merged);
    const vol = merged.filter((m) => m.market === 'Volatility').length;
    const jump = merged.filter((m) => m.market === 'Jump').length;
    console.log(
      `[Discovery] ${merged.length} markets (${vol} Volatility, ${jump} Jump) ` +
      `— ${selected.length} from catalog, rest from verified fallback`,
    );
    return merged;
  } catch (err: any) {
    console.error('[Discovery] Failed, using verified fallback:', err?.message ?? err);
    const merged = mergeWithFallback([]);
    setMarkets(merged);
    return merged;
  }
}
