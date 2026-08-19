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
};

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

  return (
    <div className="space-y-1.5">
      {digits.map((stat, i) => {
        const isRequired = required.includes(stat.digit);
        const isQuiet = quietDigits.some(c => c.digit === stat.digit);
        const isEntry = stat.digit === entryDigit;
        const barPercent = Math.min((stat.percentage / 20) * 100, 100); // scale: 20% = full bar

        let barClass = 'bg-[var(--bar-idle)]';
        let labelClass = 'text-dark-200';
        let glow = '';

        if (isEntry) {
          barClass = 'bg-gradient-to-r from-emerald-400 to-teal-300';
          labelClass = 'text-emerald-300';
          glow = 'shadow-[0_0_16px_-2px_rgba(52,211,153,0.55)] group-hover:shadow-[0_0_20px_-1px_rgba(52,211,153,0.85)]';
        } else if (isQuiet && isRequired) {
          barClass = 'bg-gradient-to-r from-emerald-500/70 to-emerald-400/40';
          labelClass = 'text-emerald-400/90';
        } else if (isRequired && !isQuiet) {
          barClass = 'bg-gradient-to-r from-red-500/70 to-red-400/40';
          labelClass = 'text-red-400';
        }

        const showIndicator =
          (isEntry && '◄') ||
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
          />
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-2.5 pt-2 text-[9px] text-dark-300 flex-wrap">
        <LegendDot cls="bg-gradient-to-r from-emerald-400 to-teal-300" label="Entry" />
        <LegendDot cls="bg-emerald-500/60" label="Quiet" />
        <LegendDot cls="bg-red-500/60" label="Active" />
        <span className="border-l border-[var(--divider)] pl-2.5 font-mono text-dark-400 tabular-nums">| {threshold.toFixed(1)}%</span>
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
}: {
  index: number;
  stat: DigitStats;
  barClass: string;
  labelClass: string;
  glow: string;
  showIndicator: string;
  threshold: number;
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
        {/* Threshold line — positioned from the live quietThreshold config */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-400/50 z-10"
          style={{ left: `${(threshold / 20) * 100}%` }}
        >
          <div className="absolute -top-0.5 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400/80" />
        </div>
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
