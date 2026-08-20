import type { DigitStats, TradeType } from '../types';
import { DEFAULT_QUIET_THRESHOLD, useStrategyConfig } from '../hooks/useStrategyConfig';
import { useCountUp } from '../hooks/useCountUp';

interface DigitDistributionProps {
  digits: DigitStats[];
  tradeType: TradeType;
  entryDigit: number | null;
  quietDigits: DigitStats[];
}

const REQUIRED_DIGITS: Record<TradeType, number[]> = {
  OVER_2: [0, 1, 2],
  OVER_3: [0, 1, 2, 3],
  UNDER_6: [6, 7, 8, 9],
  UNDER_7: [7, 8, 9],
  EVEN: [],
  ODD: [],
};

/** Digits that are "dominant" for Even/Odd (even for EVEN, odd for ODD). */
function isDominantParity(digit: number, tradeType: TradeType): boolean {
  if (tradeType === 'EVEN') return digit % 2 === 0;
  if (tradeType === 'ODD') return digit % 2 === 1;
  return false;
}

export function DigitDistribution({
  digits,
  tradeType,
  entryDigit,
  quietDigits,
}: DigitDistributionProps) {
  const required = REQUIRED_DIGITS[tradeType];
  // Quiet threshold from the server config (polled live). Falls back to the
  // documented server default while /api/config is loading or unreachable, so
  // the marker is always visible and snaps to the live value once it arrives.
  const { config } = useStrategyConfig();
  const threshold = config?.quietThreshold ?? DEFAULT_QUIET_THRESHOLD;
  const oppositeThreshold = config?.oppositeThreshold ?? 10.1;
  const dominantThreshold = config?.dominantThreshold ?? 10.7;

  const isEvenOdd = tradeType === 'EVEN' || tradeType === 'ODD';

  return (
    <div className="space-y-1.5">
      {digits.map((stat, i) => {
        const isRequired = required.includes(stat.digit);
        const isQuiet = quietDigits.some(c => c.digit === stat.digit);
        const isEntry = stat.digit === entryDigit;
        const dominant = isEvenOdd && isDominantParity(stat.digit, tradeType);
        const barPercent = Math.min((stat.percentage / 20) * 100, 100); // scale: 20% = full bar

        let barClass = 'bg-[var(--bar-idle)]';
        let labelClass = 'text-dark-200';
        let glow = '';

        if (isEntry && isEvenOdd) {
          // Even/Odd entry is always an opposite-parity digit → use amber
          barClass = 'bg-gradient-to-r from-amber-400 to-amber-300';
          labelClass = 'text-amber-300';
          glow = 'shadow-[0_0_16px_-2px_rgba(251,191,36,0.55)] group-hover:shadow-[0_0_20px_-1px_rgba(251,191,36,0.85)]';
        } else if (isEntry) {
          barClass = 'bg-gradient-to-r from-emerald-400 to-teal-300';
          labelClass = 'text-emerald-300';
          glow = 'shadow-[0_0_16px_-2px_rgba(52,211,153,0.55)] group-hover:shadow-[0_0_20px_-1px_rgba(52,211,153,0.85)]';
        } else if (isEvenOdd && dominant) {
          // Even/Odd: dominant parity digits get emerald treatment
          barClass = 'bg-gradient-to-r from-emerald-500/70 to-emerald-400/40';
          labelClass = 'text-emerald-400/90';
        } else if (isEvenOdd && !dominant) {
          // Even/Odd: opposite parity digits get amber treatment (they should be low)
          barClass = 'bg-gradient-to-r from-amber-500/60 to-amber-400/30';
          labelClass = 'text-amber-400/90';
        } else if (isQuiet && isRequired) {
          barClass = 'bg-gradient-to-r from-emerald-500/70 to-emerald-400/40';
          labelClass = 'text-emerald-400/90';
        } else if (isRequired && !isQuiet) {
          barClass = 'bg-gradient-to-r from-red-500/70 to-red-400/40';
          labelClass = 'text-red-400';
        }

        const showIndicator =
          (isEntry && '◄') ||
          (isEvenOdd && dominant && '✓') ||
          (isEvenOdd && !dominant && '○') ||
          (isQuiet && isRequired && '✓') ||
          (isRequired && !isQuiet && '✗') ||
          '';

        return (
          <DigitRow
            key={stat.digit}
            index={i}
            stat={stat}
            barClass={barClass}
            labelClass={labelClass}
            glow={glow}
            showIndicator={showIndicator}
            threshold={threshold}
            isEvenOdd={isEvenOdd}
            oppositeThreshold={oppositeThreshold}
            dominantThreshold={dominantThreshold}
          />
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-2.5 pt-2 text-[9px] text-dark-300 flex-wrap">
        {isEvenOdd ? (
          <LegendDot cls="bg-gradient-to-r from-amber-400 to-amber-300" label="Entry" />
        ) : (
          <LegendDot cls="bg-gradient-to-r from-emerald-400 to-teal-300" label="Entry" />
        )}
        {isEvenOdd ? (
          <>
            <LegendDot cls="bg-emerald-500/60" label="Dominant" />
            <LegendDot cls="bg-amber-500/60" label="Opposite" />
            <span className="border-l border-[var(--divider)] pl-2.5 font-mono text-dark-400 tabular-nums">
              | {oppositeThreshold.toFixed(1)}% / {dominantThreshold.toFixed(1)}%
            </span>
          </>
        ) : (
          <>
            <LegendDot cls="bg-emerald-500/60" label="Quiet" />
            <LegendDot cls="bg-red-500/60" label="Active" />
            <span className="border-l border-[var(--divider)] pl-2.5 font-mono text-dark-400 tabular-nums">| {threshold.toFixed(1)}%</span>
          </>
        )}
      </div>
    </div>
  );
}

function DigitRow({
  index,
  stat,
  barClass,
  labelClass,
  glow,
  showIndicator,
  threshold,
  isEvenOdd,
  oppositeThreshold,
  dominantThreshold,
}: {
  index: number;
  stat: DigitStats;
  barClass: string;
  labelClass: string;
  glow: string;
  showIndicator: string;
  threshold: number;
  isEvenOdd: boolean;
  oppositeThreshold: number;
  dominantThreshold: number;
}) {
  const barPercent = Math.min((stat.percentage / 20) * 100, 100);
  const pct = useCountUp(stat.percentage);

  return (
    <div
      className="flex items-center gap-2 group"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <span className={`w-4 text-xs font-mono font-bold text-right tabular-nums ${labelClass}`}>
        {stat.digit}
      </span>
      <div className="flex-1 h-5 rounded-md bg-[var(--track-bg)] overflow-hidden relative border border-[var(--track-border)]">
        <div
          className={`h-full rounded-md transition-all duration-700 ease-out ${barClass} ${glow}`}
          style={{ width: `${barPercent}%` }}
        />
        {isEvenOdd ? (
          <>
            {/* Opposite threshold line (10.1%) — amber */}
            <div
              className="absolute top-0 bottom-0 w-px bg-amber-400/50 z-10"
              style={{ left: `${(oppositeThreshold / 20) * 100}%` }}
            >
              <div className="absolute -top-0.5 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400/80" />
            </div>
            {/* Dominant threshold line (10.7%) — emerald */}
            <div
              className="absolute top-0 bottom-0 w-px bg-emerald-400/50 z-10"
              style={{ left: `${(dominantThreshold / 20) * 100}%` }}
            >
              <div className="absolute -top-0.5 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400/80" />
            </div>
          </>
        ) : (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-400/50 z-10"
            style={{ left: `${(threshold / 20) * 100}%` }}
          >
            <div className="absolute -top-0.5 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400/80" />
          </div>
        )}
      </div>
      <span className="w-11 text-[10px] font-mono text-right text-dark-300 tabular-nums">
        {pct.toFixed(1)}%
      </span>
      <span className="w-3 text-xs text-center">{showIndicator}</span>
    </div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-sm ${cls}`} />
      {label}
    </span>
  );
}
