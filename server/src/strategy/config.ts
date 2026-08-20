/**
 * Central strategy configuration.
 *
 * Every "magic number" the scanner depends on lives here so it can be tuned
 * without hunting through the analysis code. Defaults match the original
 * hardcoded behaviour; each is overridable via an environment variable so the
 * app can be retuned without a redeploy (and, later, via a PUT /api/config UI).
 */

export interface StrategyConfig {
  /**
   * A digit is "quiet" when its frequency over the lookback window is at or
   * below this percentage — i.e. it has been appearing less often than a
   * uniform 10%. The strategy bets quiet digits keep under-appearing relative
   * to the active (frequent) ones.
   */
  quietThreshold: number;
  /** Digits never used as entry (payout-excluded on Deriv). */
  excludeDigits: number[];
  /**
   * Even/Odd strategy: the maximum percentage for opposite-parity digits
   * (odd digits when trading Even, even digits when trading Odd).
   */
  oppositeThreshold: number;
  /**
   * Even/Odd strategy: the minimum percentage for dominant-parity digits
   * (even digits when trading Even, odd digits when trading Odd) and the
   * minimum for the top-2 appearing digits.
   */
  dominantThreshold: number;
  /** How many historical ticks to analyse per market. */
  lookbackTicks: number;
  /** How often to re-run the full historical scan (ms). */
  scanIntervalMs: number;
  /** How often to refresh the dynamic market list from Deriv (ms). */
  marketRefreshMs: number;
  /**
   * How often the client should re-poll /api/config (ms). Served to the UI so
   * the config sync cadence is tunable at runtime without a client redeploy.
   */
  configPollMs: number;
  /**
   * How often to poll `ticks_history` as a live-feed fallback when Deriv
   * refuses the real-time `ticks` stream (ms). Keeps percentages moving and
   * entry tracking alive on historical polling alone.
   */
  livePollIntervalMs: number;
  /** How many recent ticks to request per fallback `ticks_history` poll. */
  livePollCount: number;
}

function num(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function digitList(envKey: string, fallback: number[]): number[] {
  const raw = process.env[envKey];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 9);
  return parsed.length > 0 ? parsed : fallback;
}

let config: StrategyConfig = {
  // STRAT_QUIET_THRESHOLD is the current name; STRAT_COLD_THRESHOLD stays as a
  // backward-compatible alias for the old "cold" wording.
  quietThreshold: num('STRAT_QUIET_THRESHOLD', num('STRAT_COLD_THRESHOLD', 9.8)),
  excludeDigits: digitList('STRAT_EXCLUDE_DIGITS', [0, 9]),
  oppositeThreshold: num('STRAT_OPPOSITE_THRESHOLD', 10.1),
  dominantThreshold: num('STRAT_DOMINANT_THRESHOLD', 10.7),
  lookbackTicks: num('STRAT_LOOKBACK_TICKS', 1000),
  scanIntervalMs: num('STRAT_SCAN_INTERVAL_MS', 30_000),
  marketRefreshMs: num('STRAT_MARKET_REFRESH_MS', 3_600_000),
  configPollMs: num('STRAT_CONFIG_POLL_MS', 15_000),
  livePollIntervalMs: num('STRAT_LIVE_POLL_INTERVAL_MS', 2_000),
  livePollCount: num('STRAT_LIVE_POLL_COUNT', 100),
};

export function getConfig(): StrategyConfig {
  return config;
}

/** Merge a partial override into the live config (used by PUT /api/config later). */
export function updateConfig(patch: Partial<StrategyConfig>): StrategyConfig {
  config = { ...config, ...patch };
  return config;
}
