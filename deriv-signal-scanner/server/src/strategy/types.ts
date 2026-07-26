export type TradeType = 'OVER_2' | 'OVER_3' | 'UNDER_6' | 'UNDER_7';

export type TradeStatus =
  | 'pending'           // Initial state before analysis
  | 'watching_entry'    // Filter passed, waiting for entry digit on live ticks
  | 'watching_confirmation' // Entry digit hit, waiting for confirmation within 2 ticks
  | 'confirmed'         // Trade confirmed
  | 'reset';            // Confirmation failed, back to watching_entry

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
  quietDigits: DigitStats[];  // Only the digits at/under the quiet threshold (≤9.9%)

  // Entry digit (Step 2)
  entryDigit: number | null;

  // Scoring
  quietScore: number;         // Avg distance below the quiet threshold (higher = quieter = better)

  // Confirmation (Step 3)
  validConfirmationDigits: number[];
  confirmationDigit: number | null;

  // Live monitoring state
  status: TradeStatus;
  entryTriggered: boolean;
  ticksSinceEntry: number;
  confirmed: boolean;
  /** Epoch ms when the setup was confirmed; used to auto-reset stale signals. */
  confirmedAt: number | null;
}

export interface ScanResult {
  timestamp: number;
  markets: TradeSetup[];
  rankedSignals: TradeSetup[];
}
