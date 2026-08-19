export type TradeType = 'OVER_2' | 'OVER_3' | 'UNDER_6' | 'UNDER_7';

export type TradeStatus =
  | 'pending'           // Initial state before analysis
  | 'watching_entry';   // Filter passed, waiting for entry digit on live ticks

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

  // Filter results (Step 1)
  passesFilter: boolean;
  allDigits: DigitStats[];    // Full 0-9 digit distribution
  quietDigits: DigitStats[];  // Only the digits at/under the quiet threshold (≤9.7%)

  // Entry digit (Step 2)
  entryDigit: number | null;

  // Informational confirm digits — which digits would confirm/win for this
  // trade type (e.g. OVER_3 → 4-9). Shown on the cards only; the platform is
  // signal-only and never actually confirms.
  validConfirmationDigits: number[];

  // Scoring
  quietScore: number;         // Avg distance below the quiet threshold (higher = quieter = better)

  // Live monitoring state (signal-only: we never confirm, just watch the entry)
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
