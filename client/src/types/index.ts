export type TradeType = 'OVER_2' | 'OVER_3' | 'UNDER_6' | 'UNDER_7';
export type PayoutTier = 'high' | 'medium';

export type TradeStatus =
  | 'pending'
  | 'watching_entry'
  | 'watching_confirmation'
  | 'confirmed'
  | 'reset';

export interface DigitStats {
  digit: number;
  count: number;
  percentage: number;
}

export interface TradeSetup {
  tradeType: TradeType;
  marketSymbol: string;
  marketDisplayName: string;
  market: string;
  passesFilter: boolean;
  allDigits: DigitStats[];
  quietDigits: DigitStats[];
  entryDigit: number | null;
  quietScore: number;
  validConfirmationDigits: number[];
  confirmationDigit: number | null;
  status: TradeStatus;
  entryTriggered: boolean;
  ticksSinceEntry: number;
  confirmed: boolean;
  /** Epoch ms when confirmed; used for auto-reset of stale signals. */
  confirmedAt: number | null;
}

export interface ScanResult {
  timestamp: number;
  markets: TradeSetup[];
  rankedSignals: TradeSetup[];
}

export interface MarketSymbol {
  symbol: string;
  displayName: string;
  market: 'Volatility' | 'Jump';
  decimals: number;
}

export interface StrategyConfig {
  quietThreshold: number;
  excludeDigits: number[];
  lookbackTicks: number;
  confirmWithinTicks: number;
  scanIntervalMs: number;
  confirmedCooldownMs: number;
  marketRefreshMs: number;
  /** How often the client should re-poll /api/config (ms). */
  configPollMs: number;
}

