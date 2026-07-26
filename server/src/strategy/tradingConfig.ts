/**
 * Auto-trading configuration.
 *
 * Defaults encode the user's current manual bot settings (see README):
 *   - Plain Volatility indices (R_*)      → 1 tick duration
 *   - Jump (JD*) and Volatility 1s (1HZ*V) → 2 tick duration
 *   - Martingale ×1.3 after a loss → next stake = previousStake × 2 × 1.3 (i.e. ×2.6)
 *     (matches the manual Deriv bot's convention where the Martingale parameter
 *      is an additional multiplier on top of the standard 2× martingale)
 *   - Stop-loss at 2000 cumulative loss
 *   - Take-profit defaults to 1x the base stake (matching the manual bot: "TP
 *     same as stake"). Set TRADE_TAKE_PROFIT to override, or the future even/odd
 *     strategy will use 2x the stake.
 *
 * SAFETY-FIRST DEFAULTS: trading starts on the DEMO (virtual) account and is
 * DISARMED — it only logs the trade it *would* place (dry-run) until explicitly
 * armed via the API. Real-money trading requires BOTH flipping `allowReal` AND
 * arming, so nothing places a live order by accident.
 */

import { MarketFamily } from '../deriv/symbols.ts';
import { TradeType } from './types.ts';

export interface TradingConfig {
  /** Master switch for the trading subsystem. If false, no trades ever fire. */
  enabled: boolean;
  /**
   * Allow trading on a REAL money account. When false (default), the bot
   * refuses to place orders if the authorized account is not virtual/demo.
   */
  allowReal: boolean;
  /** Base stake per trade, in account currency. */
  baseStake: number;
  /** Currency for contracts (must match the account). */
  currency: string;
  /** Martingale multiplier applied to the stake after each loss. */
  martingaleMultiplier: number;
  /** Hard cap on consecutive martingale steps before forcing a reset to base. */
  maxMartingaleSteps: number;
  /** Cumulative loss (positive number) at which the bot auto-disarms. */
  stopLoss: number;
  /**
   * Cumulative profit at which the bot auto-disarms. null = disabled (user
   * stops manually). Defaults to 1x the base stake ("TP same as stake"); the
   * future even/odd strategy will use 2x the stake.
   */
  takeProfit: number | null;
  /** Default duration (ticks) per market family; per-symbol override below. */
  durationTicks: Record<MarketFamily, number>;
  /** Max simultaneous open contracts across ALL markets. */
  maxConcurrent: number;
}

function num(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(envKey: string, fallback: boolean): boolean {
  const raw = process.env[envKey];
  if (raw === undefined) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

const BASE_STAKE = num('TRADE_BASE_STAKE', 1);

let config: TradingConfig = {
  enabled: bool('TRADE_ENABLED', true),
  allowReal: bool('TRADE_ALLOW_REAL', false),
  baseStake: BASE_STAKE,
  currency: process.env.TRADE_CURRENCY ?? 'USD',
  martingaleMultiplier: num('TRADE_MARTINGALE', 1.3),
  maxMartingaleSteps: num('TRADE_MAX_MARTINGALE_STEPS', 10),
  stopLoss: num('TRADE_STOP_LOSS', 2000),
  // Default TP = 1x the base stake ("take profit same as stake"). Explicitly
  // set TRADE_TAKE_PROFIT to override; set it to 0 or a blank to disable.
  takeProfit: num('TRADE_TAKE_PROFIT', BASE_STAKE),
  durationTicks: {
    Volatility: num('TRADE_DURATION_VOL', 1), // plain R_*; 1s overridden below
    Jump: num('TRADE_DURATION_JUMP', 2),
  },
  maxConcurrent: num('TRADE_MAX_CONCURRENT', 1),
};

export function getTradingConfig(): TradingConfig {
  return config;
}

export function updateTradingConfig(patch: Partial<TradingConfig>): TradingConfig {
  // Keep the "TP same as stake" rule: if the base stake changes and no explicit
  // takeProfit is given in the same update, mirror TP onto the new stake.
  const takeProfit =
    patch.takeProfit === undefined && patch.baseStake !== undefined
      ? patch.baseStake
      : patch.takeProfit ?? config.takeProfit;
  config = {
    ...config,
    ...patch,
    takeProfit,
    durationTicks: { ...config.durationTicks, ...patch.durationTicks },
  };
  return config;
}

/**
 * Duration in ticks for a specific symbol. Plain Volatility (R_*) = 1 tick;
 * Volatility 1s (1HZ*V) and Jump = 2 ticks — matching the user's manual bot.
 */
export function durationTicksFor(symbol: string, family: MarketFamily): number {
  if (family === 'Jump') return config.durationTicks.Jump;
  const is1s = /^1HZ\d+V$/.test(symbol); // 1s variants trade at 2 ticks
  return is1s ? 2 : config.durationTicks.Volatility;
}

/** Map an internal trade type to Deriv's digit contract type + barrier. */
export function toContract(tradeType: TradeType): { contractType: string; barrier: string } {
  switch (tradeType) {
    case 'OVER_3': return { contractType: 'DIGITOVER', barrier: '3' };
    case 'OVER_2': return { contractType: 'DIGITOVER', barrier: '2' };
    case 'UNDER_6': return { contractType: 'DIGITUNDER', barrier: '6' };
    case 'UNDER_7': return { contractType: 'DIGITUNDER', barrier: '7' };
  }
}
