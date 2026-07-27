import type { TradeSetup, TradeType } from '../types';
import { DigitDistribution } from './DigitDistribution';

interface SignalCardProps {
  signal: TradeSetup;
  isLive?: boolean;
  rank?: number;
}

const TRADE_LABELS: Record<TradeType, { label: string; color: string; bg: string; border: string }> = {
  OVER_3: { label: 'Over 3', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-600/30' },
  UNDER_6: { label: 'Under 6', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-600/30' },
  OVER_2: { label: 'Over 2', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-600/30' },
  UNDER_7: { label: 'Under 7', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-600/30' },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-dark-400 bg-dark-600' },
  watching_entry: { label: 'Watching Entry', color: 'text-blue-400 bg-blue-500/10' },
  watching_confirmation: { label: 'Watching Confirm', color: 'text-amber-400 bg-amber-500/10' },
  confirmed: { label: 'CONFIRMED ✓', color: 'text-emerald-400 bg-emerald-500/10' },
  reset: { label: 'Reset', color: 'text-dark-400 bg-dark-600' },
};

export function SignalCard({ signal, isLive, rank }: SignalCardProps) {
  const style = TRADE_LABELS[signal.tradeType];
  const statusBadge = STATUS_BADGES[signal.status] ?? STATUS_BADGES.pending;
  const isHighPayout = signal.tradeType === 'OVER_3' || signal.tradeType === 'UNDER_6';
  const isEmerald = style.border.includes('emerald');
  const hoverBorder = signal.status === 'confirmed'
    ? 'hover:border-emerald-500/50'
    : isEmerald
      ? 'hover:border-emerald-500/50'
      : 'hover:border-amber-500/50';

  if (!signal.passesFilter) return null;

  return (
    <div className={`rounded-2xl border ${style.border} bg-dark-800 overflow-hidden transition-all duration-300 ${hoverBorder} hover:shadow-lg hover:shadow-emerald-500/5 animate-fade-in-up`}>
      {/* Card header */}
      <div className={`px-5 py-3 ${style.bg} border-b ${style.border} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {rank !== undefined && (
            <span className="text-[10px] font-bold text-dark-400 bg-dark-700 px-1.5 py-0.5 rounded">
              #{rank}
            </span>
          )}
          <span className={`text-base font-bold ${style.color}`}>{style.label}</span>
          {isHighPayout && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-500 bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-700/30">
              ✦ High
            </span>
          )}
          {signal.quietScore > 0 && (
            <span className="text-[10px] font-mono font-medium text-dark-300 bg-dark-700 px-1.5 py-0.5 rounded">
              {signal.quietScore.toFixed(1)}°
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(isLive || statusBadge.label !== 'Pending') && (
            <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Market info */}
      <div className="px-5 py-2 border-b border-dark-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{signal.marketDisplayName}</span>
          <span className="text-[10px] font-mono text-dark-400">{signal.marketSymbol}</span>
        </div>
        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider bg-dark-600 px-2 py-0.5 rounded">
          {signal.market}
        </span>
      </div>

      {/* Entry & Confirmation */}
      <div className="px-5 py-3 border-b border-dark-600">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-dark-400">Entry Digit</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono ${signal.entryDigit !== null ? 'text-emerald-400' : 'text-dark-400'}`}>
                {signal.entryDigit !== null ? signal.entryDigit : '—'}
              </span>
              {signal.entryDigit !== null && (
                <span className="text-[9px] text-dark-500">(quietest)</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-dark-400">Confirm With</span>
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {signal.validConfirmationDigits.map(d => (
                <span key={d} className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
        {signal.confirmed && signal.confirmationDigit !== null && (
          <div className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <span className="text-xs font-bold text-emerald-400">
              ✓ CONFIRMED — Digit {signal.confirmationDigit} triggered!
            </span>
          </div>
        )}
      </div>

      {/* Digit distribution */}
      <div className="px-5 py-3">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-dark-400 mb-2 block">Digit Distribution</span>
        <DigitDistribution
          digits={signal.allDigits?.length > 0 ? [...signal.allDigits].sort((a, b) => a.digit - b.digit) : []}
          marketKey={signal.marketSymbol}
        />
      </div>
    </div>
  );
}
