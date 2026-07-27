/**
 * Real-Time Pattern Analytics Engine (Section 5)
 *
 * Four modules evaluated on a digit-window:
 *   A) Shannon Entropy        — How uniform is the digit distribution?
 *   B) Runs Test (Wald-Wolf.) — Are Even/Odd streaks longer than random?
 *   C) Chi-Square             — Do digit counts differ from uniform 10%?
 *   D) Spoiler                — Which digit deviates most from 10%?
 *
 * All modules return p-values + 95% CI. Significance uses Bonferroni-corrected
 * threshold α_corrected = 0.05 / 4 = 0.0125 (display only — does not gate execution).
 */

import {
  DigitStats,
  AnalyticsEngineOutput,
  ShannonEntropyResult,
  RunsTestResult,
  ChiSquareResult,
  SpoilerResult,
} from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const BONFERRONI_ALPHA = 0.05 / 4; // 0.0125
const LOG2_10 = Math.log2(10);       // ≈ 3.3219 — max entropy for 10 categories

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normal CDF approximation (Abramowitz & Stegun 26.2.17) */
function normCdf(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
  const p = 1 - phi * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5);
  return z >= 0 ? p : 1 - p;
}

/** Inverse χ² CDF approximation (simple Wilson-Hilferty) */
function chiSquarePValue(x2: number, df: number): number {
  if (x2 <= 0) return 1;
  const z = Math.cbrt(x2 / df);
  const meanZ = 1 - 2 / (9 * df);
  const seZ = Math.sqrt(2 / (9 * df));
  const zScore = (z - meanZ) / seZ;
  return 1 - normCdf(zScore);
}

/** Fisher z-transform SE for correlation */
function fisherSE(n: number): number {
  return 1 / Math.sqrt(n - 3);
}

/** Approximate 95% CI for p (proportion) using Wilson score */
function proportionCI(p: number, n: number): [number, number] {
  const z = 1.96;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return [
    Math.max(0, center - margin),
    Math.min(1, center + margin),
  ];
}

// ─── Module A: Shannon Entropy ──────────────────────────────────────────────

/**
 * H = -Σ p_i log2(p_i)
 * Uniform 10-digit → H ≈ 3.32 (max).
 * Big deviation from 3.32 → possible structure.
 */
export function computeShannonEntropy(digits: DigitStats[]): ShannonEntropyResult {
  const n = digits.reduce((s, d) => s + d.count, 0);
  if (n === 0) {
    return {
      metricValue: 0,
      maxEntropy: LOG2_10,
      uniformityRatio: 0,
      pValue: 0.5,
      isSignificant: false,
      confidenceInterval: [0, 0],
    };
  }

  let H = 0;
  for (const d of digits) {
    const p = d.count / n;
    if (p > 0) H -= p * Math.log2(p);
  }

  const uniformityRatio = H / LOG2_10;

  // P-value: approximate via bootstrap-like simulation.
  // Under uniform H0, E[H] ≈ 3.32, and the distribution is roughly normal.
  // SE for entropy is ~ sqrt( (Σ p_i (log2(p_i))² - H²) / n )
  let variance = 0;
  for (const d of digits) {
    const p = d.count / n;
    if (p > 0) {
      const logP = Math.log2(p);
      variance += p * logP * logP - (p * logP) ** 2;
    }
  }
  // Add term for estimation uncertainty
  for (const d of digits) {
    const p = d.count / n;
    if (p > 0) {
      variance += (p * (1 - p)) / (n * Math.LN2 * Math.LN2 * d.count);
    }
  }
  const se = Math.sqrt(Math.max(0, variance / n));
  const zScore = se > 0 ? (LOG2_10 - H) / se : 0;
  const pValue = normCdf(-Math.abs(zScore));

  // 95% CI for entropy using normal approximation
  const ci: [number, number] = se > 0
    ? [Math.max(0, H - 1.96 * se), Math.min(LOG2_10, H + 1.96 * se)]
    : [H, H];

  return {
    metricValue: +H.toFixed(4),
    maxEntropy: LOG2_10,
    uniformityRatio: +uniformityRatio.toFixed(4),
    pValue: +pValue.toFixed(4),
    isSignificant: pValue < BONFERRONI_ALPHA,
    confidenceInterval: [+ci[0].toFixed(4), +ci[1].toFixed(4)],
  };
}

// ─── Module B: Runs Test (Wald-Wolfowitz) ───────────────────────────────────

/**
 * Convert digit sequence to Even (E) / Odd (O) binary, count runs.
 * Z = (R - E[R]) / SE[R]
 * where E[R] = 1 + 2n1*n2/(n1+n2)
 *       SE[R] = sqrt(2n1*n2(2n1*n2 - n1 - n2) / ((n1+n2)²(n1+n2-1)))
 */
export function computeRunsTest(
  digits: DigitStats[],
  digitSequence: number[],
): RunsTestResult {
  const n = digitSequence.length;
  if (n < 2) {
    return {
      zScore: 0,
      runsObserved: 0,
      runsExpected: 0,
      evenCount: 0,
      oddCount: 0,
      metricValue: 0,
      pValue: 0.5,
      isSignificant: false,
      confidenceInterval: [0, 0],
    };
  }

  const evenCount = digitSequence.filter((d) => d % 2 === 0).length;
  const oddCount = n - evenCount;

  // Count runs
  let runs = 1;
  for (let i = 1; i < n; i++) {
    const prevParity = digitSequence[i - 1] % 2;
    const currParity = digitSequence[i] % 2;
    if (prevParity !== currParity) runs++;
  }

  // Expected runs under H0 (random sequence)
  const n1 = evenCount;
  const n2 = oddCount;
  const expectedRuns = 1 + (2 * n1 * n2) / (n1 + n2);

  // Standard error
  const numerator = 2 * n1 * n2 * (2 * n1 * n2 - n1 - n2);
  const denominator = (n1 + n2) ** 2 * (n1 + n2 - 1);
  const se = denominator > 0 ? Math.sqrt(numerator / denominator) : 1;

  const zScore = se > 0 ? (runs - expectedRuns) / se : 0;
  const pValue = 2 * normCdf(-Math.abs(zScore)); // two-tailed

  // 95% CI for the z-score itself
  const ciZ = fisherSE(n);
  const ci: [number, number] = [
    +(-1.96 * ciZ).toFixed(4),
    +(1.96 * ciZ).toFixed(4),
  ];

  return {
    zScore: +zScore.toFixed(4),
    runsObserved: runs,
    runsExpected: +expectedRuns.toFixed(2),
    evenCount,
    oddCount,
    metricValue: +zScore.toFixed(4),
    pValue: +pValue.toFixed(4),
    isSignificant: pValue < BONFERRONI_ALPHA,
    confidenceInterval: ci,
  };
}

// ─── Module C: Chi-Square Goodness-of-Fit ───────────────────────────────────

/**
 * χ² = Σ (O_i - E_i)² / E_i
 * df = 9 (10 digits - 1)
 * H0: uniform distribution (E_i = n/10 for each digit)
 */
export function computeChiSquare(digits: DigitStats[]): ChiSquareResult {
  const n = digits.reduce((s, d) => s + d.count, 0);
  if (n < 10) {
    return {
      chiSquareValue: 0,
      degreesOfFreedom: 9,
      metricValue: 0,
      pValue: 1,
      isSignificant: false,
      confidenceInterval: [0, 0],
    };
  }

  const expected = n / 10;
  let x2 = 0;
  for (const d of digits) {
    const diff = d.count - expected;
    x2 += (diff * diff) / expected;
  }

  const pValue = chiSquarePValue(x2, 9);

  // 95% CI for χ²/n (mean squared deviation ratio)
  const ratio = x2 / n;
  const seRatio = Math.sqrt((2 * 9) / (n * n)); // rough approximation
  const ci: [number, number] = [
    +Math.max(0, ratio - 1.96 * seRatio).toFixed(4),
    +(ratio + 1.96 * seRatio).toFixed(4),
  ];

  return {
    chiSquareValue: +x2.toFixed(4),
    degreesOfFreedom: 9,
    metricValue: +x2.toFixed(4),
    pValue: +pValue.toFixed(4),
    isSignificant: pValue < BONFERRONI_ALPHA,
    confidenceInterval: ci,
  };
}

// ─── Module D: Spoiler / Digit Anomaly ──────────────────────────────────────

/**
 * Max single-digit deviation from expected 10% share.
 * Reports which digit deviates most and by how much.
 */
export function computeSpoiler(digits: DigitStats[]): SpoilerResult {
  const n = digits.reduce((s, d) => s + d.count, 0);
  if (n === 0) {
    return {
      spoilerDigit: 0,
      deviationPct: 0,
      metricValue: 0,
      pValue: 0.5,
      isSignificant: false,
      confidenceInterval: [0, 0],
    };
  }

  let maxDev = 0;
  let spoilerDigit = 0;
  for (const d of digits) {
    const observedPct = (d.count / n) * 100;
    const dev = Math.abs(observedPct - 10);
    if (dev > maxDev) {
      maxDev = dev;
      spoilerDigit = d.digit;
    }
  }

  const observedP = maxDev / 100;
  // P-value: proportion test for the deviation
  const expectedP = 0.1;
  const se = Math.sqrt((expectedP * (1 - expectedP)) / n);
  const zScore = se > 0 ? (maxDev / 100) / se : 0;
  const pValue = 2 * normCdf(-Math.abs(zScore)); // two-tailed

  // 95% CI for the proportion of the spoiler digit
  const spoiler = digits.find((d) => d.digit === spoilerDigit)!;
  const ci = proportionCI(spoiler.count / n, n);

  return {
    spoilerDigit,
    deviationPct: +maxDev.toFixed(2),
    metricValue: +maxDev.toFixed(2),
    pValue: +pValue.toFixed(4),
    isSignificant: pValue < BONFERRONI_ALPHA,
    confidenceInterval: [+(ci[0] * 100).toFixed(2), +(ci[1] * 100).toFixed(2)],
  };
}

// ─── Quality Score ──────────────────────────────────────────────────────────

/**
 * Weighted composite of currently significant modules.
 * If zero modules are significant, returns 0 (honest "NO SIGNAL").
 */
export function computeQualityScore(
  entropy: ShannonEntropyResult,
  runs: RunsTestResult,
  chi2: ChiSquareResult,
  spoiler: SpoilerResult,
  prevWeights?: Record<string, number>,
): number {
  const significant: Array<{ key: string; weight: number }> = [];

  if (entropy.isSignificant) {
    significant.push({
      key: 'shannonEntropy',
      weight: prevWeights?.shannonEntropy ?? 0.25,
    });
  }
  if (runs.isSignificant) {
    significant.push({
      key: 'runsTestZScore',
      weight: prevWeights?.runsTestZScore ?? 0.25,
    });
  }
  if (chi2.isSignificant) {
    significant.push({
      key: 'chiSquareValue',
      weight: prevWeights?.chiSquareValue ?? 0.25,
    });
  }
  if (spoiler.isSignificant) {
    significant.push({
      key: 'spoilerWeight',
      weight: prevWeights?.spoilerWeight ?? 0.25,
    });
  }

  if (significant.length === 0) return 0;

  const totalWeight = significant.reduce((s, x) => s + x.weight, 0);
  if (totalWeight === 0) return 0;

  // Weighted average of module deviations from their null expectations
  let score = 0;
  for (const sig of significant) {
    switch (sig.key) {
      case 'shannonEntropy':
        score += sig.weight * (1 - entropy.uniformityRatio) * 100;
        break;
      case 'runsTestZScore':
        score += sig.weight * Math.min(Math.abs(runs.zScore) * 20, 100);
        break;
      case 'chiSquareValue': {
        const maxChi2 = 10 * 9; // rough upper bound
        score += sig.weight * Math.min((chi2.chiSquareValue / maxChi2) * 100, 100);
        break;
      }
      case 'spoilerWeight':
        score += sig.weight * Math.min(spoiler.deviationPct * 10, 100);
        break;
    }
  }

  return +Math.min(score / totalWeight, 100).toFixed(1);
}

// ─── Dominant Parity ────────────────────────────────────────────────────────

export function computeParity(digits: DigitStats[]): {
  dominantParity: 'EVEN' | 'ODD' | 'NEUTRAL';
  evenRatio: number;
  oddRatio: number;
} {
  const n = digits.reduce((s, d) => s + d.count, 0);
  if (n === 0) {
    return { dominantParity: 'NEUTRAL', evenRatio: 0.5, oddRatio: 0.5 };
  }

  let even = 0;
  for (const d of digits) {
    if (d.digit % 2 === 0) even += d.count;
  }
  const evenRatio = +((even / n) * 100).toFixed(1);
  const oddRatio = +(((n - even) / n) * 100).toFixed(1);

  let dominantParity: 'EVEN' | 'ODD' | 'NEUTRAL';
  if (evenRatio > 55) dominantParity = 'EVEN';
  else if (oddRatio > 55) dominantParity = 'ODD';
  else dominantParity = 'NEUTRAL';

  return { dominantParity, evenRatio, oddRatio };
}

// ─── Full Engine Run ────────────────────────────────────────────────────────

export function runAnalyticsEngine(
  digits: DigitStats[],
  digitSequence: number[],
  prevWeights?: Record<string, number>,
): AnalyticsEngineOutput {
  const entropy = computeShannonEntropy(digits);
  const runs = computeRunsTest(digits, digitSequence);
  const chi2 = computeChiSquare(digits);
  const spoiler = computeSpoiler(digits);

  const qualityScore = computeQualityScore(entropy, runs, chi2, spoiler, prevWeights);
  const parity = computeParity(digits);

  const significantModules: string[] = [];
  if (entropy.isSignificant) significantModules.push('entropy');
  if (runs.isSignificant) significantModules.push('runsTest');
  if (chi2.isSignificant) significantModules.push('chiSquare');
  if (spoiler.isSignificant) significantModules.push('spoiler');

  return {
    shannonEntropy: entropy,
    runsTest: runs,
    chiSquare: chi2,
    spoiler: spoiler,
    qualityScore,
    dominantParity: parity.dominantParity,
    evenRatio: parity.evenRatio,
    oddRatio: parity.oddRatio,
    significantModules,
    timestamp: Date.now(),
  };
}
