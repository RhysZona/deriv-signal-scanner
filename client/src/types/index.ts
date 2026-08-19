export type TradeType = 'OVER_2' | 'OVER_3' | 'UNDER_6' | 'UNDER_7';
export type PayoutTier = 'high' | 'medium';

export type TradeStatus =
  | 'pending'
  | 'watching_entry';

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
  /** Informational — which digits would confirm/win for this trade type (signal-only, never confirmed). */
  validConfirmationDigits: number[];
  quietScore: number;
  status: TradeStatus;
  entryTriggered: boolean;
  /** Epoch ms when the entry digit last appeared on live ticks (drives the "seen" pulse). */
  entryTriggeredAt: number | null;
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
  scanIntervalMs: number;
  marketRefreshMs: number;
  /** How often the client should re-poll /api/config (ms). */
  configPollMs: number;
}

