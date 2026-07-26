import { derivConnection } from '../deriv/connection.ts';
import { getMarkets, setSymbolDecimals, removeSymbol, MarketSymbol } from '../deriv/symbols.ts';
import { discoverMarkets } from '../deriv/marketDiscovery.ts';
import {
  analyzeMarket,
  rankSignals,
  getLastDigit,
  observedDecimals,
  checkConfirmation,
} from '../strategy/analyzer.ts';
import { getConfig } from '../strategy/config.ts';
import { trader } from '../trader/trader.ts';
import { TradeSetup, ScanResult } from '../strategy/types.ts';

export type ScanCallback = (
  result: ScanResult,
  liveUpdates?: TradeSetup[],
) => void;

class Scanner {
  private running = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private healthInterval: NodeJS.Timeout | null = null;
  // Multiple SSE clients can listen; each registers a callback.
  private callbacks = new Set<ScanCallback>();
  private lastResult: ScanResult | null = null;
  // Symbol → live TradeSetup[] (only for markets with active signals)
  private liveSetups = new Map<string, TradeSetup[]>();
  // Unsubscribe functions per symbol
  private unsubscribers = new Map<string, () => void>();

  /** Register a listener; returns an unsubscribe function. */
  onResult(cb: ScanCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  private emit(result: ScanResult, liveUpdates?: TradeSetup[]) {
    for (const cb of this.callbacks) {
      try {
        cb(result, liveUpdates);
      } catch (err) {
        console.error('[Scanner] Listener threw:', err);
      }
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    console.log('[Scanner] Starting...');

    const { scanIntervalMs, marketRefreshMs } = getConfig();

    try {
      await derivConnection.connect();
      await discoverMarkets();
      await this.runScan();

      this.scanInterval = setInterval(() => this.runScan(), scanIntervalMs);
      // Periodically refresh the market list so new/renamed markets are picked up.
      this.refreshInterval = setInterval(() => {
        discoverMarkets().catch((e) => console.error('[Scanner] Refresh failed:', e));
      }, marketRefreshMs);
      // Watch for a silently stalled live feed.
      this.healthInterval = setInterval(() => derivConnection.checkFeedHealth(), 5_000);
    } catch (err) {
      console.error('[Scanner] Failed to start:', err);
      this.running = false;
    }
  }

  stop() {
    this.running = false;
    for (const t of [this.scanInterval, this.refreshInterval, this.healthInterval]) {
      if (t) clearInterval(t);
    }
    this.scanInterval = this.refreshInterval = this.healthInterval = null;
    for (const unsub of this.unsubscribers.values()) unsub();
    this.unsubscribers.clear();
    this.liveSetups.clear();
    this.lastResult = null;
  }

  // ── Scan ────────────────────────────────────────────────────────────────

  private async runScan() {
    const markets = getMarkets();
    console.log(`[Scanner] Scanning ${markets.length} markets...`);
    const promises = markets.map((m) => this.fetchAndAnalyze(m));
    const nested = await Promise.allSettled(promises);
    const allResults: TradeSetup[] = [];

    for (const result of nested) {
      if (result.status === 'fulfilled') allResults.push(...result.value);
    }

    const ranked = rankSignals(allResults);
    const scanResult: ScanResult = {
      timestamp: Date.now(),
      markets: allResults,
      rankedSignals: ranked,
    };
    this.lastResult = scanResult;

    console.log(`[Scanner] Found ${ranked.length} signal(s)`);
    this.startLiveMonitoring(ranked);
    this.emit(scanResult);
  }

  private async fetchAndAnalyze(market: MarketSymbol): Promise<TradeSetup[]> {
    try {
      const { lookbackTicks } = getConfig();
      const res = await derivConnection.send({
        ticks_history: market.symbol,
        adjust_start_time: 1,
        count: lookbackTicks,
        end: 'latest',
        start: 1,
        style: 'ticks',
      });

      const prices: number[] | undefined = res?.history?.prices;
      if (prices?.length) {
        // Self-correct precision: trust the max decimals actually seen in the
        // data over a possibly-stale pip-derived value, so digit analysis is
        // never computed at the wrong precision.
        const seen = Math.max(...prices.map(observedDecimals));
        const decimals = Math.max(market.decimals, seen);
        if (decimals !== market.decimals) setSymbolDecimals(market.symbol, decimals);

        return analyzeMarket(
          market.symbol,
          market.displayName,
          market.market,
          prices,
          decimals,
        );
      }
      console.warn(`[Scanner] No prices for ${market.symbol}`);
      return [];
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      // If Deriv says the symbol isn't valid for this region/account, stop
      // requesting it every scan instead of logging the same error forever.
      if (/invalid/i.test(msg)) {
        console.warn(`[Scanner] Dropping unavailable symbol ${market.symbol}: ${msg}`);
        removeSymbol(market.symbol);
      } else {
        console.error(`[Scanner] Error fetching ${market.symbol}:`, msg);
      }
      return [];
    }
  }

  // ── Live Monitoring ──────────────────────────────────────────────────────

  private startLiveMonitoring(signals: TradeSetup[]) {
    const activeSymbols = new Set(signals.map((s) => s.marketSymbol));

    // Unsubscribe symbols that no longer have a signal.
    for (const [sym, unsub] of this.unsubscribers) {
      if (!activeSymbols.has(sym)) {
        unsub();
        this.unsubscribers.delete(sym);
        this.liveSetups.delete(sym);
      }
    }

    for (const symbol of activeSymbols) {
      const fresh = signals.filter((s) => s.marketSymbol === symbol);
      const existing = this.liveSetups.get(symbol);

      // Merge: preserve in-progress live FSM state across rescans instead of
      // wiping it. Re-baseline only when the setup's parameters changed.
      const merged = fresh.map((f) => {
        const prev = existing?.find((e) => e.tradeType === f.tradeType);
        if (
          prev &&
          prev.entryDigit === f.entryDigit &&
          arraysEqual(prev.validConfirmationDigits, f.validConfirmationDigits)
        ) {
          // Same setup — keep live status, refresh the analysis snapshot.
          return {
            ...f,
            status: prev.status,
            entryTriggered: prev.entryTriggered,
            ticksSinceEntry: prev.ticksSinceEntry,
            confirmed: prev.confirmed,
            confirmedAt: prev.confirmedAt,
            confirmationDigit: prev.confirmationDigit,
          };
        }
        return f; // new or changed setup — start fresh
      });

      this.liveSetups.set(symbol, merged);

      if (this.unsubscribers.has(symbol)) continue; // already subscribed

      const decimalsFor = () =>
        getMarkets().find((m) => m.symbol === symbol)?.decimals ?? 2;

      const unsub = derivConnection.subscribe(symbol, (tick: any) => {
        const digit = getLastDigit(tick.quote, decimalsFor());
        const setups = this.liveSetups.get(symbol);
        if (!setups) return;

        const updated = setups.map((prev) => {
          const next = checkConfirmation(prev, digit);
          // Fire the trader exactly once, on the rising edge into `confirmed`.
          if (next.status === 'confirmed' && prev.status !== 'confirmed') {
            void trader.onConfirmedSignal(next);
          }
          return next;
        });
        this.liveSetups.set(symbol, updated);

        if (this.lastResult) {
          const allLive: TradeSetup[] = [];
          for (const s of this.liveSetups.values()) allLive.push(...s);
          this.emit(this.lastResult, allLive);
        }
      });

      this.unsubscribers.set(symbol, unsub);
    }
  }
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export const scanner = new Scanner();
