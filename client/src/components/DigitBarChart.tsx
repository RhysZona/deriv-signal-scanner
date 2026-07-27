import { useRef } from 'react';
import type { DigitStats } from '../types';

interface DigitBarChartProps {
  /** Label shown in the chart header (e.g. "Slow Window" / "Fast Window"). */
  label: string;
  /** Digit statistics to render. */
  digits: DigitStats[];
  /** Unique key to reset baseline when market changes. */
  marketKey?: string;
  /** Subtitle showing tick count. */
  tickCount: number;
}

/** Max percentage for the y-axis scale — 20% fills the full height. */
const MAX_PCT = 20;
/** Bar chart vertical height in px. */
const CHART_HEIGHT = 180;
/** Gap width for the separator between Even and Odd groups. */
const SEPARATOR_GAP = 3;

export function DigitBarChart({ label, digits, marketKey, tickCount }: DigitBarChartProps) {
  // ── Baseline tracking (same pattern as DigitDistribution) ──────────────
  const baselineRef = useRef<Record<number, number> | null>(null);
  const prevKeyRef = useRef<string | undefined>(undefined);

  if (marketKey !== prevKeyRef.current) {
    baselineRef.current = null;
    prevKeyRef.current = marketKey;
  }

  if (!baselineRef.current && digits.length > 0 && digits.some((d) => d.count > 0)) {
    baselineRef.current = {};
    for (const d of digits) {
      baselineRef.current[d.digit] = d.percentage;
    }
  }

  const baseline = baselineRef.current;

  // Split into Even and Odd groups
  const evens = digits.filter((d) => d.digit % 2 === 0).sort((a, b) => a.digit - b.digit);
  const odds = digits.filter((d) => d.digit % 2 !== 0).sort((a, b) => a.digit - b.digit);

  // Bar renderer
  const renderBar = (stat: DigitStats) => {
    const barHeight = Math.min((stat.percentage / MAX_PCT) * CHART_HEIGHT, CHART_HEIGHT);
    const isBaselineSet = baseline?.[stat.digit] !== undefined;
    const baselinePct = baseline?.[stat.digit] ?? stat.percentage;
    const diff = isBaselineSet ? stat.percentage - baselinePct : 0;
    const isRising = diff > 0.1;
    const isFalling = diff < -0.1;

    const barColor = isRising
      ? 'bg-emerald-500/60'
      : isFalling
        ? 'bg-red-500/60'
        : 'bg-blue-500/40';

    const barBorder = isRising
      ? 'border-emerald-500/30'
      : isFalling
        ? 'border-red-500/30'
        : 'border-blue-500/20';

    return (
      <div
        key={stat.digit}
        className="flex-1 relative flex flex-col items-center justify-end min-w-0"
        style={{ height: CHART_HEIGHT }}
      >
        {/* Percentage label at top of bar */}
        <span className={`text-[9px] font-mono font-bold tabular-nums mb-0.5 transition-colors duration-300 ${
          isRising ? 'text-emerald-400' : isFalling ? 'text-red-400' : 'text-dark-200'
        }`}>
          {stat.percentage.toFixed(1)}%
        </span>

        {/* Bar */}
        <div
          className={`w-full rounded-t-sm border transition-all duration-500 ${barColor} ${barBorder}`}
          style={{
            height: `${Math.max(barHeight, 2)}px`,
            minHeight: stat.percentage > 0 ? 2 : 0,
          }}
          title={`Digit ${stat.digit}: ${stat.percentage.toFixed(1)}%`}
        />

        {/* Baseline marker line on this bar */}
        {isBaselineSet && (
          <div
            className="absolute w-full h-px bg-white/50 z-10 transition-all duration-500"
            style={{ bottom: `${(baselinePct / MAX_PCT) * 100}%` }}
            title={`Init: ${baselinePct.toFixed(1)}%`}
          />
        )}

        {/* Change indicator */}
        {isBaselineSet && (
          <span className={`absolute text-[7px] font-mono ${
            isRising ? 'text-emerald-400' : isFalling ? 'text-red-400' : 'text-dark-500'
          }`}
            style={{ bottom: `${(baselinePct / MAX_PCT) * 100 + 2}%`, right: -2 }}
          >
            {diff > 0 ? '▲' : diff < 0 ? '▼' : ''}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">
          {label}
        </h3>
        <span className="text-[10px] font-mono text-dark-400">{tickCount} ticks</span>
      </div>

      {/* Chart area */}
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        {/* Y-axis grid lines + labels */}
        <div className="absolute inset-0 flex flex-col-reverse justify-between pointer-events-none z-20">
          {[0, 5, 10, 15, 20].filter((v) => v <= MAX_PCT).map((pct) => (
            <div key={pct} className="flex items-center w-full">
              <span className="w-8 text-[8px] font-mono text-dark-500 tabular-nums">{pct}%</span>
              <div className="flex-1 border-t border-dark-600/40 ml-1" />
            </div>
          ))}
        </div>

        {/* 10% expected horizontal reference line (dashed, subtle) */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-dark-500/30 pointer-events-none z-10"
          style={{ bottom: `${(10 / MAX_PCT) * 100}%` }}
        />

        {/* Bars container */}
        <div className="absolute inset-0 flex items-end gap-0" style={{ paddingLeft: 36, paddingBottom: 0 }}>
          {/* Even group */}
          {evens.map((stat) => (
            <div key={stat.digit} className="flex-[2]">
              {renderBar(stat)}
            </div>
          ))}

          {/* Separator gap */}
          <div className="w-[12px] shrink-0 relative">
            {/* Vertical separator line */}
            <div className="absolute inset-y-[15%] left-1/2 -translate-x-1/2 w-px bg-dark-500/40" />
          </div>

          {/* Odd group */}
          {odds.map((stat) => (
            <div key={stat.digit} className="flex-[2]">
              {renderBar(stat)}
            </div>
          ))}
        </div>
      </div>

      {/* X-axis: digit numbers with category labels */}
      <div className="flex items-start mt-1" style={{ paddingLeft: 36 }}>
        {/* Even labels */}
        <div className="flex flex-[10] gap-0">
          {evens.map((stat) => (
            <div key={stat.digit} className="flex-1 text-center">
              <span className="text-[9px] font-mono font-bold text-blue-300/70">{stat.digit}</span>
            </div>
          ))}
        </div>

        {/* Separator spacing */}
        <div className="w-[12px] shrink-0" />

        {/* Odd labels */}
        <div className="flex flex-[10] gap-0">
          {odds.map((stat) => (
            <div key={stat.digit} className="flex-1 text-center">
              <span className="text-[9px] font-mono font-bold text-amber-300/70">{stat.digit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category labels */}
      <div className="flex items-center mt-0.5" style={{ paddingLeft: 36 }}>
        <div className="flex flex-[10] justify-around">
          <span className="text-[8px] font-semibold uppercase tracking-wider text-blue-400/60">Even</span>
        </div>
        <div className="w-[12px] shrink-0" />
        <div className="flex flex-[10] justify-around">
          <span className="text-[8px] font-semibold uppercase tracking-wider text-amber-400/60">Odd</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[8px] text-dark-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-px bg-white/40 inline-block" /> Init pos
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 border-t border-dashed border-dark-500/50 inline-block" /> 10% expected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500/60" /> Rising
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500/60" /> Falling
        </span>
      </div>
    </div>
  );
}
