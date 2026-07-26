import { derivConnection } from '../deriv/connection.ts';
import { getMarkets, MarketFamily } from '../deriv/symbols.ts';
import { getTradingConfig, durationTicksFor, toContract } from '../strategy/tradingConfig.ts';
import { TradeSetup } from '../strategy/types.ts';

/**
 * Auto-trader.
 *
 * Consumes confirmed signals from the scanner and — WHEN ARMED — places a
 * single Deriv digit contract at a time, applying martingale on losses and
 * auto-disarming on the stop-loss or take-profit limit.
 *
 * Safety model (defence in depth — a trade fires only if ALL hold):
 *   1. trading `enabled` (master switch)
 *   2. `armed` (per-session, set via API; cleared on stop-loss/TP/restart)
 *   3. authorized to Deriv with a token
 *   4. account is virtual OR `allowReal` is explicitly true
 *   5. no other contract currently open (one-at-a-time global lock)
 * If any fails, the signal is logged as a DRY-RUN (what it *would* have done)
 * and no order is sent.
 */

export interface TradeRecord {
  id: string;
  time: number;
  symbol: string;
  displayName: string;
  tradeType: string;
  contractType: string;
  barrier: string;
  durationTicks: number;
  stake: number;
  martingaleStep: number;
  dryRun: boolean;
  contractId?: number;
  status: 'placed' | 'won' | 'lost' | 'error' | 'dry_run';
  profit?: number;
  error?: string;
}

export interface TraderState {
  enabled: boolean;
  armed: boolean;
  authorized: boolean;
  account: { loginid: string; isVirtual: boolean; currency: string } | null;
  allowReal: boolean;
  openContract: boolean;
  currentStake: number;
  martingaleStep: number;
  sessionPnL: number;
  wins: number;
  losses: number;
  lastDisarmReason: string | null;
}

type TradeEventHandler = (record: TradeRecord, state: TraderState) => void;

class Trader {
  private armed = false;
  private openContract = false; // one-at-a-time global lock
  private currentStake: number;
  private martingaleStep = 0;
  private sessionPnL = 0;
  private wins = 0;
  private losses = 0;
  private lastDisarmReason: string | null = null;
  private recentTrades: TradeRecord[] = [];
  private seq = 0;
  private handlers = new Set<TradeEventHandler>();

  constructor() {
    this.currentStake = getTradingConfig().baseStake;
  }

  onTrade(cb: TradeEventHandler): () => void {
    this.handlers.add(cb);
    return () => this.handlers.delete(cb);
  }

  private emit(record: TradeRecord) {
    this.recentTrades.unshift(record);
    if (this.recentTrades.length > 100) this.recentTrades.pop();
    const state = this.getState();
    for (const h of this.handlers) {
      try {
        h(record, state);
      } catch (e) {
        console.error('[Trader] handler threw:', e);
      }
    }
  }

  getState(): TraderState {
    const cfg = getTradingConfig();
    const acct = derivConnection.getAccount();
    return {
      enabled: cfg.enabled,
      armed: this.armed,
      authorized: derivConnection.isAuthorized(),
      account: acct ? { loginid: acct.loginid, isVirtual: acct.isVirtual, currency: acct.currency } : null,
      allowReal: cfg.allowReal,
      openContract: this.openContract,
      currentStake: this.currentStake,
      martingaleStep: this.martingaleStep,
      sessionPnL: +this.sessionPnL.toFixed(2),
      wins: this.wins,
      losses: this.losses,
      lastDisarmReason: this.lastDisarmReason,
    };
  }

  getRecentTrades(): TradeRecord[] {
    return this.recentTrades;
  }

  /** Arm live trading for this session. Resets the martingale ladder. */
  arm(): TraderState {
    const cfg = getTradingConfig();
    if (!cfg.enabled) {
      this.lastDisarmReason = 'trading disabled in config';
      return this.getState();
    }
    this.armed = true;
    this.lastDisarmReason = null;
    this.currentStake = cfg.baseStake;
    this.martingaleStep = 0;
    console.log('[Trader] ARMED');
    return this.getState();
  }

  disarm(reason = 'manual'): TraderState {
    if (this.armed) console.log(`[Trader] DISARMED (${reason})`);
    this.armed = false;
    this.lastDisarmReason = reason;
    return this.getState();
  }

  /** Reset session accounting (P&L, wins/losses, martingale). Does not arm. */
  resetSession(): TraderState {
    this.sessionPnL = 0;
    this.wins = 0;
    this.losses = 0;
    this.martingaleStep = 0;
    this.currentStake = getTradingConfig().baseStake;
    return this.getState();
  }

  /**
   * Called by the scanner when a setup transitions to `confirmed`.
   * Decides whether to place a real order or log a dry-run.
   */
  async onConfirmedSignal(setup: TradeSetup): Promise<void> {
    const cfg = getTradingConfig();
    const family = (getMarkets().find((m) => m.symbol === setup.marketSymbol)?.market ??
      'Volatility') as MarketFamily;
    const { contractType, barrier } = toContract(setup.tradeType);
    const duration = durationTicksFor(setup.marketSymbol, family);
    const stake = +this.currentStake.toFixed(2);

    const base: Omit<TradeRecord, 'status' | 'dryRun'> = {
      id: `t${++this.seq}`,
      time: Date.now(),
      symbol: setup.marketSymbol,
      displayName: setup.marketDisplayName,
      tradeType: setup.tradeType,
      contractType,
      barrier,
      durationTicks: duration,
      stake,
      martingaleStep: this.martingaleStep,
    };

    // ── Gate checks (any failure → dry-run, no order) ──
    const acct = derivConnection.getAccount();
    const gateReason = this.blockedReason(cfg, acct);
    if (gateReason) {
      this.emit({ ...base, dryRun: true, status: 'dry_run', error: gateReason });
      console.log(`[Trader] DRY-RUN ${setup.marketSymbol} ${setup.tradeType} stake=${stake} — ${gateReason}`);
      return;
    }

    // ── Place the order (one-at-a-time lock) ──
    this.openContract = true;
    let placed: TradeRecord = { ...base, dryRun: false, status: 'placed' };
    try {
      const buy = await derivConnection.buyContract({
        symbol: setup.marketSymbol,
        contractType,
        barrier,
        durationTicks: duration,
        stake,
        currency: cfg.currency,
      });
      placed = { ...placed, contractId: buy.contractId };
      this.emit(placed);
      console.log(`[Trader] BUY ${setup.marketSymbol} ${contractType} ${barrier} stake=${stake} cid=${buy.contractId}`);

      const outcome = await derivConnection.waitForSettlement(buy.contractId);
      this.settle(placed, outcome.profit);
    } catch (err: any) {
      this.openContract = false;
      const msg = err?.message ?? String(err);
      this.emit({ ...placed, status: 'error', error: msg });
      console.error(`[Trader] Trade error on ${setup.marketSymbol}:`, msg);
    }
  }

  /** Apply a settled contract's profit to session state + martingale ladder. */
  private settle(record: TradeRecord, profit: number) {
    this.openContract = false;
    this.sessionPnL += profit;
    const cfg = getTradingConfig();

    if (profit >= 0) {
      this.wins++;
      this.martingaleStep = 0;
      this.currentStake = cfg.baseStake; // reset ladder on any win
      this.emit({ ...record, status: 'won', profit: +profit.toFixed(2) });
    } else {
      this.losses++;
      this.martingaleStep++;
      if (this.martingaleStep >= cfg.maxMartingaleSteps) {
        // Cap hit — reset to base rather than escalate unboundedly.
        this.martingaleStep = 0;
        this.currentStake = cfg.baseStake;
        console.warn('[Trader] Max martingale steps hit — resetting stake to base');
      } else {
        // Martingale × multiplier means: 2 × martingaleMultiplier × previousStake
        // (matches the manual Deriv bot: a Martingale of 1.3 → 2.6× the stake)
        this.currentStake = +(this.currentStake * 2 * cfg.martingaleMultiplier).toFixed(2);
      }
      this.emit({ ...record, status: 'lost', profit: +profit.toFixed(2) });
    }

    console.log(`[Trader] Settled ${record.symbol}: profit=${profit.toFixed(2)} sessionPnL=${this.sessionPnL.toFixed(2)} nextStake=${this.currentStake}`);

    // ── Auto-disarm on risk limits ──
    if (this.sessionPnL <= -Math.abs(cfg.stopLoss)) {
      this.disarm(`stop-loss hit (P&L ${this.sessionPnL.toFixed(2)})`);
    } else if (cfg.takeProfit != null && this.sessionPnL >= cfg.takeProfit) {
      this.disarm(`take-profit hit (P&L ${this.sessionPnL.toFixed(2)})`);
    }
  }

  /** Return a human reason the trade is blocked, or null if clear to trade. */
  private blockedReason(
    cfg: ReturnType<typeof getTradingConfig>,
    acct: ReturnType<typeof derivConnection.getAccount>,
  ): string | null {
    if (!cfg.enabled) return 'trading disabled';
    if (!this.armed) return 'not armed';
    if (!derivConnection.isAuthorized() || !acct) return 'not authorized (no DERIV_API_TOKEN)';
    if (!acct.isVirtual && !cfg.allowReal) return 'real account but allowReal=false (safety block)';
    if (this.openContract) return 'another contract already open (one-at-a-time)';
    if (this.sessionPnL <= -Math.abs(cfg.stopLoss)) return 'stop-loss already reached';
    return null;
  }
}

export const trader = new Trader();
