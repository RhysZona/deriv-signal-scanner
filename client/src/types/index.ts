// ─── Trade / Contract Types ─────────────────────────────────────────────────

export type TradeType = 'OVER_2' | 'OVER_3' | 'UNDER_6' | 'UNDER_7';
export type DerivContractType = 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITMATCH' | 'DIGITDIFF';
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

export interface MarketSymbol {
  symbol: string;
  displayName: string;
  market: 'Volatility' | 'Jump';
  decimals: number;
}

// ─── Analytics Engine Results (Section 5) ───────────────────────────────────

export interface AnalyticsModuleResult {
  metricValue: number;
  pValue: number;
  isSignificant: boolean;        // Bonferroni-corrected (α = 0.05/4 = 0.0125)
  confidenceInterval: [number, number]; // 95% CI
}

export interface ShannonEntropyResult extends AnalyticsModuleResult {
  maxEntropy: number;            // log2(10) ≈ 3.32
  uniformityRatio: number;       // actual / max (0-1)
}

export interface RunsTestResult extends AnalyticsModuleResult {
  zScore: number;
  runsObserved: number;
  runsExpected: number;
  evenCount: number;
  oddCount: number;
}

export interface ChiSquareResult extends AnalyticsModuleResult {
  chiSquareValue: number;
  degreesOfFreedom: number;       // 9 (for digits 0-9)
}

export interface SpoilerResult extends AnalyticsModuleResult {
  spoilerDigit: number;
  deviationPct: number;           // |observed - 10%|
}

export interface AnalyticsEngineOutput {
  shannonEntropy: ShannonEntropyResult;
  runsTest: RunsTestResult;
  chiSquare: ChiSquareResult;
  spoiler: SpoilerResult;
  qualityScore: number;           // weighted composite of significant modules
  dominantParity: 'EVEN' | 'ODD' | 'NEUTRAL';
  evenRatio: number;
  oddRatio: number;
  significantModules: string[];   // modules where isSignificant = true
  timestamp: number;
}

// ─── Telemetry (Section 8) ──────────────────────────────────────────────────

export interface PreTradeState {
  macroDominantParity: 'EVEN' | 'ODD';
  macroEvenRatio: number;
  macroOddRatio: number;
  greenCircleDigit: number;
  greenCircleIsDominant: boolean;
  redCircleDigit: number;
  redCircleIsNonDominant: boolean;
  triggerSequence: string[];
  engineQualityScore: number;
  shannonEntropy: number;
  runsTestZScore: number;
  chiSquareValue: number;
  spoilerDigit: number;
  spoilerWeight: number;
  significantModules: string[];
}

export interface InTradeSnapshot {
  tickOffset: number;
  quote: number;
  digit: number;
  parity: 'E' | 'O';
  entropyDelta: number;
  spoilerWeightDelta: number;
}

export interface PostTradeState {
  exitDigit: number;
  contractResult: 'WIN' | 'LOSS';
  profit: number;
  durationTicks: number;
  entropyShift: number;
  parityShift: number;
  spoilerShift: number;
}

export interface TradeTelemetry {
  tradeId: string;                // e.g. "TRD_20260727_0098"
  marketSymbol: string;
  executionMode: 'AUTO_BOT_SCRIPT' | 'MANUAL_OVERRIDE';
  timestamp: number;
  contractId: number | null;      // filled once buy() resolves

  preTradeState: PreTradeState;
  inTradeSnapshots: InTradeSnapshot[];
  postTradeState: PostTradeState | null;
}

// ─── Calibration (Section 5.3) ──────────────────────────────────────────────

export interface CalibrationResult {
  locked: boolean;
  reason: string;
  weights: Record<string, number> | null;
  sampleSize: number;
  minSample: number;
  stats: CalibrationMetric[] | null;
}

export interface CalibrationMetric {
  metric: string;
  r: number;
  ci95: [number, number];
}

// ─── Trade Setup (Scanner/Strategy) ─────────────────────────────────────────

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
  confirmedAt: number | null;
}

export interface ScanResult {
  timestamp: number;
  markets: TradeSetup[];
  rankedSignals: TradeSetup[];
}

// ─── Trading (Existing) ─────────────────────────────────────────────────────

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

// ─── Connection / Auth (Section 3) ──────────────────────────────────────────

export interface DerivAccountInfo {
  loginid: string;
  isVirtual: boolean;
  currency: string;
  balance: number;
  scopes: string[];
}

export interface ConnectionStatus {
  connected: boolean;
  authorized: boolean;
  account: DerivAccountInfo | null;
  feedDegraded: boolean;
  tokenScope?: string;
  tokenExpiry?: number;
}

// ─── Dual-Window Config (Section 4) ─────────────────────────────────────────

export interface WindowConfig {
  slowWindowSize: number;        // default 1000
  fastWindowSize: number;        // user-adjustable, min 10
}

// ─── Digit Rank Colors (Section 2) ──────────────────────────────────────────

export type DigitRank = 'green' | 'blue' | 'yellow' | 'red';

export interface DigitRankInfo {
  digit: number;
  percentage: number;
  rank: DigitRank;
}
