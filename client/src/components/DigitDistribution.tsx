import { useRef } from 'react';
import type { DigitStats } from '../types';

interface DigitDistributionProps {
  digits: DigitStats[];       // Full 0-9 digit statistics
  /** Unique key to reset the baseline when the market changes. */
  marketKey?: string;
}

/** Max percentage scale for the bars — 20% fills the full width. */
const MAX_PCT = 20;

export function DigitDistribution({ digits, marketKey }: DigitDistributionProps) {
  // Capture initial digit percentages as a baseline when the market (or digits) first load.
  // We snapshot at the first non-empty `digits` array to get the "opening" position.
  // The reset is done synchronously at render time (not in an effect) so there is no
  // one-frame flash where the old baseline is compared against new market data.
  const baselineRef = useRef<Record<number, number> | null>(null);
  const prevKeyRef = useRef<string | undefined>(undefined);

  // Reset baseline synchronously when marketKey changes
  if (marketKey !== prevKeyRef.current) {
    baselineRef.current = null;
    prevKeyRef.current = marketKey;
  }

  // Snapshot baseline on first meaningful data (after potential reset above)
  if (!baselineRef.current && digits.length > 0 && digits.some((d) => d.count > 0)) {
    baselineRef.current = {};
    for (const d of digits) {
      baselineRef.current[d.digit] = d.percentage;
    }
  }

  const baseline = baselineRef.current;

  // Even/Odd stats
  const evenDigits = digits.filter((d) => d.digit % 2 === 0);
  const oddDigits = digits.filter((d) => d.digit % 2 !== 0);
  const evenPct = evenDigits.reduce((s, d) => s + d.percentage, 0);
  const oddPct = oddDigits.reduce((s, d) => s + d.percentage, 0);

  return (
    <div className="space-y-4">
      {/* Digit Distribution Circles (0-9) */}
      <div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-dark-400 mb-2 block">
          Digit Distribution
        </span>
        <div className="grid grid-cols-10 gap-1.5">
          {[...digits].sort((a, b) => a.digit - b.digit).map((stat) => {
            const isBaselineSet = baseline?.[stat.digit] !== undefined;
            const diff = isBaselineSet ? stat.percentage - baseline![stat.digit] : 0;
            const isRising = diff > 0.1;
            const isFalling = diff < -0.1;

            return (
              <div
                key={stat.digit}
                className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-xl border transition-all hover:scale-105 ${
                  isRising
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                    : isFalling
                      ? 'border-red-500/60 bg-red-500/10 text-red-400'
                      : 'border-dark-500 bg-dark-700/30 text-dark-200'
                }`}
                title={`Digit ${stat.digit}: ${stat.percentage.toFixed(1)}%${isBaselineSet ? ` (${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)` : ''}`}
              >
                <span className="text-xs font-bold">{stat.digit}</span>
                <span className="text-[8px] font-mono opacity-80">
                  {stat.percentage.toFixed(1)}%
                </span>
                {isBaselineSet && (
                  <span className={`text-[7px] font-mono ${isRising ? 'text-emerald-400' : isFalling ? 'text-red-400' : 'text-dark-500'}`}>
                    {diff > 0 ? '▲' : diff < 0 ? '▼' : '—'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Even/Odd Summary Bar */}
      <div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-dark-400 mb-1.5 block">
          Even / Odd Split
        </span>
        <div className="relative h-5 rounded-full overflow-hidden bg-dark-700 border border-dark-500">
          <div
            className="absolute inset-y-0 left-0 bg-blue-500/40 transition-all duration-500"
            style={{ width: `${evenPct}%` }}
          />
          <div className="absolute inset-y-0 right-0 bg-amber-500/40 transition-all duration-500"
            style={{ width: `${oddPct}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white/80">
            <span className="text-blue-300 mr-2">E {evenPct.toFixed(1)}%</span>
            <span className="text-amber-300">O {oddPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Bar chart — left axis = percentage, single color, baseline line, green/red change */}
      <div className="space-y-1.5">
        {/* Column header */}
        <div className="flex items-center gap-2 text-[8px] text-dark-500 uppercase tracking-wider pb-0.5">
          <span className="w-12 text-right">%</span>
          <span className="w-4 text-center">#</span>
          <span className="flex-1">Distribution</span>
          <span className="w-16 text-right">Change</span>
        </div>

        {[...digits].sort((a, b) => a.digit - b.digit).map((stat) => {
          const barPercent = Math.min((stat.percentage / MAX_PCT) * 100, 100);
          const isBaselineSet = baseline?.[stat.digit] !== undefined;
          const baselinePct = baseline?.[stat.digit] ?? stat.percentage;
          const baselineBarPos = Math.min((baselinePct / MAX_PCT) * 100, 100);
          const diff = isBaselineSet ? stat.percentage - baselinePct : 0;
          const isRising = diff > 0.1;
          const isFalling = diff < -0.1;

          // Bar color: neutral by default, green if rising from baseline, red if falling
          const barColor = isRising
            ? 'bg-emerald-500/60'
            : isFalling
              ? 'bg-red-500/60'
              : 'bg-blue-500/40';

          return (
            <div key={stat.digit} className="flex items-center gap-2 group">
              {/* Left axis: percentage value */}
              <span className="w-12 text-[9px] font-mono text-right text-dark-300 tabular-nums">
                {stat.percentage.toFixed(1)}%
              </span>

              {/* Digit number */}
              <span className="w-4 text-[10px] font-mono font-bold text-center text-dark-200">
                {stat.digit}
              </span>

              {/* Bar with baseline marker */}
              <div className="flex-1 h-5 bg-dark-700 rounded-sm overflow-hidden relative">
                <div
                  className={`h-full rounded-sm transition-all duration-500 ${barColor}`}
                  style={{ width: `${barPercent}%` }}
                />
                {/* Baseline position line */}
                {isBaselineSet && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10 rounded-full transition-all duration-500"
                    style={{ left: `${baselineBarPos}%` }}
                    title={`Baseline: ${baselinePct.toFixed(1)}%`}
                  />
                )}
                {/* 10% expected line */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-dark-400/20 z-10"
                  style={{ left: `${(10 / MAX_PCT) * 100}%` }}
                />
              </div>

              {/* Change indicator */}
              <span className={`w-16 text-[9px] font-mono text-right tabular-nums ${
                isRising ? 'text-emerald-400' : isFalling ? 'text-red-400' : 'text-dark-500'
              }`}>
                {isBaselineSet ? (
                  <>{diff > 0 ? '+' : ''}{diff.toFixed(1)}% {diff > 0 ? '▲' : diff < 0 ? '▼' : '—'}</>
                ) : (
                  <span className="text-dark-500">—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[8px] text-dark-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500/60" /> Rising
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500/60" /> Falling
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500/40" /> Baseline
        </span>
        <span className="flex items-center gap-1">
          <span className="w-px h-3 bg-white/40 inline-block" /> Init Pos
        </span>
        <span className="border-l border-dark-600 pl-2">| 10% expected</span>
      </div>
    </div>
  );
}
