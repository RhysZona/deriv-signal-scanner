import type { DigitStats, TradeType } from '../types';

interface DigitDistributionProps {
  digits: DigitStats[];
  tradeType: TradeType;
  entryDigit: number | null;
  quietDigits: DigitStats[];
  validConfirmationDigits: number[];
}

const REQUIRED_DIGITS: Record<TradeType, number[]> = {
  OVER_2: [0, 1, 2],
  OVER_3: [0, 1, 2, 3],
  UNDER_6: [6, 7, 8, 9],
  UNDER_7: [7, 8, 9],
};

const THRESHOLD = 9.9;

export function DigitDistribution({
  digits,
  tradeType,
  entryDigit,
  quietDigits,
  validConfirmationDigits,
}: DigitDistributionProps) {
  const required = REQUIRED_DIGITS[tradeType];
  const maxBarWidth = 100;

  return (
    <div className="space-y-1">
      {digits.map((stat) => {
        const isRequired = required.includes(stat.digit);
        const isQuiet = quietDigits.some(c => c.digit === stat.digit);
        const isEntry = stat.digit === entryDigit;
        const isConfirmation = validConfirmationDigits.includes(stat.digit);
        const barPercent = Math.min(stat.percentage / 20 * 100, 100); // scale: 20% = full bar

        let barColor = 'bg-dark-400';
        let labelColor = 'text-dark-200';

        if (isEntry) {
          barColor = 'bg-emerald-500';
          labelColor = 'text-emerald-300';
        } else if (isQuiet && isRequired) {
          barColor = 'bg-emerald-700/60';
          labelColor = 'text-emerald-400';
        } else if (isConfirmation && isRequired) {
          barColor = 'bg-emerald-700/30';
          labelColor = 'text-emerald-400/60';
        } else if (isConfirmation) {
          barColor = 'bg-blue-700/40';
          labelColor = 'text-blue-400';
        } else if (isRequired && !isQuiet) {
          barColor = 'bg-red-700/50';
          labelColor = 'text-red-400';
        }

        const showIndicator =
          (isEntry && '◄') ||
          (isQuiet && isRequired && '✓') ||
          (isRequired && !isQuiet && '✗') ||
          '';

        return (
          <div key={stat.digit} className="flex items-center gap-2 group">
            <span className={`w-4 text-xs font-mono font-bold text-right ${labelColor}`}>
              {stat.digit}
            </span>
            <div className="flex-1 h-5 bg-dark-700 rounded-sm overflow-hidden relative digit-bar-glow">
              <div
                className={`h-full rounded-sm transition-all duration-500 ${barColor}`}
                style={{ width: `${barPercent}%` }}
              />
              {/* Threshold line */}
              <div
                className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10"
                style={{ left: `${(THRESHOLD / 20) * 100}%` }}
              />
            </div>
            <span className="w-12 text-[10px] font-mono text-right text-dark-300 tabular-nums">
              {stat.percentage.toFixed(1)}%
            </span>
            {showIndicator && (
              <span className="w-4 text-xs text-center">{showIndicator}</span>
            )}
          </div>
        );
      })}
      {/* Legend */}
      <div className="flex items-center gap-3 pt-2 text-[9px] text-dark-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-500" /> Entry
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-700/60" /> Quiet ✓
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-red-700/50" /> Active ✗
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-blue-700/40" /> Confirm
        </span>
        <span className="border-l border-dark-600 pl-2 text-dark-500">| 9.9%</span>
      </div>
    </div>
  );
}
