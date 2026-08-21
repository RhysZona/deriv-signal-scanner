import { derivConnection } from '../deriv/connection.ts';
import { getMarkets, setSymbolDecimals, removeSymbol, MarketSymbol } from '../deriv/symbols.ts';
import { discoverMarkets } from '../deriv/marketDiscovery.ts';
import {
  analyzeMarket,
  rankSignals,
  getLastDigit,
  observedDecimals,
  trackEntryTick,
} from '../strategy/analyzer.ts';
import { getConfig } from '../strategy/config.ts';
import { TradeSetup, ScanResult } from '../strategy/types.ts';

export type ScanCallback = (
  result: ScanResult,
  liveUpdates?: TradeSetup[],
) => void;

export interface ScannerRateLimitInfo {
  /** Epoch ms when the rate-limit backoff expires (0 = not rate-limited). */
  rateLimitedUntil: number;
  /** How many consecutive rate-limited scans triggered the backoff. */
  consecutiveRateLimits: number;
}

export type ScannerStatusCallback = (info: ScannerRateLimitInfo) => void;

/** How often (ms) to probe whether a refused live ticks stream has recovered. */
const RESUBSCRIBE_RETRY_MS = 30_000;

class Scanner {
  private running = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private healthInterval: NodeJS.Timeout | null = null;
  // Multiple SSE clients can listen; each registers a callback.
  private callbacks = new Set<ScanCallback>();
  private statusCallbacks = new Set<ScannerStatusCallback>();
  private lastResult: ScanResult | null = null;
  // Symbol → live TradeSetup[] (only for markets with active signals)
  private liveSetups = new Map<string, TradeSetup[]>();
  // Unsubscribe functions per symbol (live `ticks` subscriptions)
  private unsubscribers = new Map<string, () => void>();
  // Symbol → rolling window of the most recent tick prices (capped at
  // lookbackTicks). Seeded from the latest scan's history so live percentages
  // are continuous with the scan snapshot, then rolls forward on each tick.
  private liveBuffers = new Map<string, number[]>();
  // Symbol → prices fetched in the most recent scan (used to (re)seed buffers).
  private lastScanPrices = new Map<string, number[]>();
  // Symbol → epoch seconds fetched in the most recent scan (poll baseline).
  private lastScanTimes = new Map<string, number[]>();
  // Symbol → poll fallback interval (ticks_history) while the live stream is refused
  private pollTimers = new Map<string, NodeJS.Timeout>();
  // Symbol → epoch of the last tick fed through the poll fallback (dedupe)
  private pollEpochs = new Map<string, number>();
  // Symbol → last time we probed the live stream for recovery
  private lastResubscribeAt = new Map<string, number>();
  // When the last ticks_history rate limit was hit — scan and pollers pause
  // until this time, then retry with exponential backoff.
  private rateLimitedUntil = 0;
  // Consecutive rate-limited scans for backoff calculation (resets on success)
  private consecutiveRateLimits = 0;

  /** Register a listener; returns an unsubscribe function. */
  onResult(cb: ScanCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  /** Register a scanner-status listener (rate-limit changes). */
  onScannerStatus(cb: ScannerStatusCallback): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  /** Current rate-limit state. */
  getRateLimitInfo(): ScannerRateLimitInfo {
    return {
      rateLimitedUntil: this.rateLimitedUntil,
      consecutiveRateLimits: this.consecutiveRateLimits,
    };
  }

  private emitStatus() {
    const info = this.getRateLimitInfo();
    for (const cb of this.statusCallbacks) {
      try { cb(info); } catch (err) { console.error('[Scanner] Status listener threw:', err); }
    }
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
      // Watch for a silently stalled live feed and keep live vs. poll fallback
      // in sync (switch to polling when the stream is refused, back to live
      // when it recovers).
      this.healthInterval = setInterval(() => {
        derivConnection.checkFeedHealth();
        this.reconcileLiveFeeds();
      }, 5_000);
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
    for (const t of this.pollTimers.values()) clearInterval(t);
    this.pollTimers.clear();
    this.liveSetups.clear();
    this.liveBuffers.clear();
    this.lastScanPrices.clear();
    this.lastScanTimes.clear();
    this.pollEpochs.clear();
    this.lastResubscribeAt.clear();
    this.lastResult = null;
    this.rateLimitedUntil = 0;
    this.consecutiveRateLimits = 0;
    this.emitStatus();
  }

  // ── Scan ────────────────────────────────────────────────────────────────

  private async runScan() {
    // If we're rate-limited, skip this scan cycle entirely. The backoff
    // duration doubles with each consecutive rate limit (caps at 5 min).
    if (Date.now() < this.rateLimitedUntil) {
      const remaining = Math.ceil((this.rateLimitedUntil - Date.now()) / 1000);
      console.log(`[Scanner] Rate-limited — skipping scan, retrying in ${remaining}s`);
      // Re-emit the last result with a fresh timestamp so the client's
      // countdown resets and doesn't get stuck on "—".
      if (this.lastResult) {
        this.emit({ ...this.lastResult, timestamp: Date.now() });
      }
      return;
    }

    const markets = getMarkets();
    console.log(`[Scanner] Scanning ${markets.length} markets...`);
    const promises = markets.map((m) => this.fetchAndAnalyze(m));
    const nested = await Promise.allSettled(promises);
    const allResults: TradeSetup[] = [];
    let rateLimitedCount = 0;

    for (const result of nested) {
      if (result.status === 'fulfilled') allResults.push(...result.value);
      if (result.status === 'rejected' && /rate limit/i.test(result.reason?.message ?? '')) {
        rateLimitedCount++;
      }
    }

    // If all markets were rate-limited, back off. Exponential: 30s → 60s →
    // 120s → 240s → 300s (cap).
    if (rateLimitedCount === markets.length && markets.length > 0) {
      this.consecutiveRateLimits++;
      const backoffMs = Math.min(30_000 * Math.pow(2, this.consecutiveRateLimits - 1), 300_000);
      this.rateLimitedUntil = Date.now() + backoffMs;
      console.warn(`[Scanner] All ${markets.length} markets rate-limited — backing off ${backoffMs / 1000}s (attempt #${this.consecutiveRateLimits})`);
      // Stop pollers — they use the same endpoint and make it worse.
      this.pauseAllPollers();
      this.emitStatus();
      return;
    }

    // At least some markets succeeded — reset rate-limit state.
    if (this.consecutiveRateLimits > 0) {
      console.log(`[Scanner] Scan recovered after ${this.consecutiveRateLimits} rate-limited cycle(s)`);
      this.consecutiveRateLimits = 0;
      this.rateLimitedUntil = 0;
      this.emitStatus();
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
        // Stash the scan's history so live rolling windows can be (re)seeded
        // from it, keeping live percentages continuous with the scan snapshot.
        this.lastScanPrices.set(market.symbol, prices);
        const times: number[] | undefined = res?.history?.times;
        if (times?.length) this.lastScanTimes.set(market.symbol, times);

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
        this.liveBuffers.delete(sym);
        this.stopPolling(sym);
        this.lastScanPrices.delete(sym);
        this.lastScanTimes.delete(sym);
        this.lastResubscribeAt.delete(sym);
      }
    }

    for (const symbol of activeSymbols) {
      const fresh = signals.filter((s) => s.marketSymbol === symbol);
      const existing = this.liveSetups.get(symbol);

      // Merge: preserve live entry state ("seen" pulse) across rescans
      // instead of wiping it. Re-baseline only when the entry digit changed.
      const merged = mergeLiveState(fresh, existing);
      this.liveSetups.set(symbol, merged);

      // (Re)seed the rolling window from this scan's fresh history so live
      // percentages continue exactly where the scan snapshot left off.
      const scanPrices = this.lastScanPrices.get(symbol);
      if (scanPrices && scanPrices.length > 0) {
        this.liveBuffers.set(symbol, [...scanPrices]);
        // Baseline the poll dedupe at the scan's newest tick so the first poll
        // never re-feeds ticks that are already in the seeded window (which
        // would double-count them). Never move the baseline backwards.
        const scanTimes = this.lastScanTimes.get(symbol);
        if (scanTimes && scanTimes.length > 0) {
          const scanEpoch = scanTimes[scanTimes.length - 1];
          this.pollEpochs.set(symbol, Math.max(this.pollEpochs.get(symbol) ?? 0, scanEpoch));
        }
      }

      this.ensureLiveFeed(symbol);
    }
  }

  /**
   * Make sure `symbol` has a working live feed: a real-time `ticks`
   * subscription when the stream is available, or a `ticks_history` poll
   * fallback when Deriv refuses the stream. Also probes for stream recovery
   * so we can switch back to real-time when it becomes available again.
   */
  private ensureLiveFeed(symbol: string) {
    // Live ticks are flowing — nothing to do (and drop any poll fallback).
    if (derivConnection.isSymbolSubscribed(symbol)) {
      this.stopPolling(symbol);
      return;
    }

    // No live subscription for this symbol right now — clear any stale unsub
    // (e.g. a subscribe attempt that failed and was cleaned up by the
    // connection) so it can be retried.
    this.unsubscribers.delete(symbol);

    if (derivConnection.isLiveStreamBlocked()) {
      this.ensurePolling(symbol);
      // Periodically probe whether the stream recovered. A successful
      // subscribe flips the connection back to live, and the next reconcile
      // drops the poll fallback.
      const lastAttempt = this.lastResubscribeAt.get(symbol) ?? 0;
      if (Date.now() - lastAttempt >= RESUBSCRIBE_RETRY_MS) {
        this.lastResubscribeAt.set(symbol, Date.now());
        this.subscribeLive(symbol);
      }
      return;
    }

    // Stream not known to be blocked — try a real-time subscription.
    this.stopPolling(symbol);
    this.subscribeLive(symbol);
  }

  private subscribeLive(symbol: string) {
    if (this.unsubscribers.has(symbol)) return;
    const unsub = derivConnection.subscribe(symbol, (tick: any) => {
      this.processLiveTick(symbol, tick);
    });
    this.unsubscribers.set(symbol, unsub);
  }

  /** Pause all tick-history pollers (e.g. when rate-limited). */
  private pauseAllPollers() {
    for (const [sym, t] of this.pollTimers) {
      clearInterval(t);
      console.log(`[Scanner] Pausing poller for ${sym}`);
    }
    this.pollTimers.clear();
  }

  /** Start (or keep) the ticks_history poll fallback for a symbol. */
  private ensurePolling(symbol: string) {
    // Don't start pollers while rate-limited — they'd just fail and waste quota.
    if (Date.now() < this.rateLimitedUntil) return;
    if (this.pollTimers.has(symbol)) return;
    const { livePollIntervalMs } = getConfig();
    console.log(
      `[Scanner] Live stream refused — polling ticks_history for ${symbol} as live-feed fallback`,
    );
    const run = () => {
      this.pollTicks(symbol).catch((e) =>
        console.error(`[Scanner] Poll failed for ${symbol}:`, e?.message ?? e),
      );
    };
    this.pollTimers.set(symbol, setInterval(run, livePollIntervalMs));
    run(); // immediate first poll
  }

  private stopPolling(symbol: string) {
    const t = this.pollTimers.get(symbol);
    if (t) clearInterval(t);
    this.pollTimers.delete(symbol);
  }

  /** Fetch recent history via ticks_history and feed only the new ticks through. */
  private async pollTicks(symbol: string) {
    const { livePollCount } = getConfig();
    let res;
    try {
      res = await derivConnection.send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: livePollCount,
        end: 'latest',
        start: 1,
        style: 'ticks',
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (/rate limit/i.test(msg)) {
        // This endpoint is rate-limited — pause pollers and flag the scanner
        // so the next scan cycle also backs off instead of wasting quota.
        console.warn(`[Scanner] Poll rate-limited for ${symbol} — pausing all pollers`);
        this.consecutiveRateLimits = Math.max(this.consecutiveRateLimits, 1);
        this.rateLimitedUntil = Math.max(this.rateLimitedUntil, Date.now() + 60_000);
        this.pauseAllPollers();
      } else {
        console.error(`[Scanner] Poll failed for ${symbol}:`, msg);
      }
      return;
    }
    const prices: number[] | undefined = res?.history?.prices;
    const times: number[] | undefined = res?.history?.times;
    if (!prices?.length || !times?.length) return;

    const lastEpoch = this.pollEpochs.get(symbol) ?? 0;
    let fed = 0;
    for (let i = 0; i < times.length; i++) {
      if (times[i] > lastEpoch) {
        this.processLiveTick(symbol, { quote: prices[i], epoch: times[i] });
        fed++;
      }
    }
    if (fed > 0) {
      this.pollEpochs.set(symbol, times[times.length - 1]);
    }
  }

  /**
   * Reconcile live vs. poll fallback for every monitored symbol. Runs on the
   * health interval so a refused stream engages polling and a recovered stream
   * returns to real-time ticks without waiting for the next scan.
   */
  private reconcileLiveFeeds() {
    for (const symbol of this.liveSetups.keys()) {
      this.ensureLiveFeed(symbol);
    }
  }

  /**
   * Shared per-tick processing for both real-time ticks and the polling
   * fallback: roll the price window, track whether the entry digit appeared,
   * recompute the digit analysis from the rolling window, merge with the live
   * entry state, and emit a live_update. Signal-only: the setup never leaves
   * `watching_entry` — we present the entry instruction, never confirm it.
   */
  private processLiveTick(symbol: string, tick: { quote: number; epoch?: number }) {
    const setups = this.liveSetups.get(symbol);
    if (!setups) return;

    const market = getMarkets().find((m) => m.symbol === symbol);
    const decimals = market?.decimals ?? 2;
    const digit = getLastDigit(tick.quote, decimals);

    // 1. Roll the price window forward with this tick.
    const buffer = this.liveBuffers.get(symbol) ?? [];
    buffer.push(tick.quote);
    const lookbackTicks = getConfig().lookbackTicks;
    if (buffer.length > lookbackTicks) {
      buffer.splice(0, buffer.length - lookbackTicks);
    }
    this.liveBuffers.set(symbol, buffer);

    // 2. Track whether the entry digit appeared on this tick (sets the
    //    entryTriggered/entryTriggeredAt "seen" pulse). No state transition.
    const tracked = setups.map((prev) => trackEntryTick(prev, digit));

    // 3. Recompute the digit analysis from the rolling window and merge it
    //    with the live entry state, so percentages crawl between scans.
    //    Only setups already being monitored are refreshed (a market that
    //    no longer passes the filter is dropped at the next scan, not
    //    mid-window).
    const fresh = analyzeMarket(
      symbol,
      market?.displayName ?? symbol,
      market?.market ?? 'Volatility',
      buffer,
      decimals,
    ).filter((f) => tracked.some((s) => s.tradeType === f.tradeType));
    const updated = mergeLiveState(fresh, tracked);
    this.liveSetups.set(symbol, updated);

    if (this.lastResult) {
      const allLive: TradeSetup[] = [];
      for (const s of this.liveSetups.values()) allLive.push(...s);
      this.emit(this.lastResult, allLive);
    }
  }
}

/**
 * Merge a fresh analysis snapshot into existing live state. Preserves the
 * live entry state (entryTriggered / entryTriggeredAt "seen" pulse) whenever
 * the setup's entry digit is unchanged; otherwise the changed setup starts
 * fresh. Signal-only: there is no confirmation state to preserve.
 */
function mergeLiveState(
  fresh: TradeSetup[],
  existing: TradeSetup[] | undefined,
): TradeSetup[] {
  return fresh.map((f) => {
    const prev = existing?.find((e) => e.tradeType === f.tradeType);
    if (prev && prev.entryDigit === f.entryDigit) {
      // Same setup — keep the live entry state, refresh the analysis snapshot.
      return {
        ...f,
        entryTriggered: prev.entryTriggered,
        entryTriggeredAt: prev.entryTriggeredAt,
      };
    }
    return f; // new or changed setup — start fresh
  });
}

export const scanner = new Scanner();
