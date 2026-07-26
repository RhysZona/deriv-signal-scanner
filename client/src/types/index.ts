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

// ── Trading ──────────────────────────────────────────────────────────────────

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
