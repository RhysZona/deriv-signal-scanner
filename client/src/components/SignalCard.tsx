import type { TradeSetup, TradeType } from '../types';
import { DigitDistribution } from './DigitDistribution';
import { StatusOrb } from './StatusOrb';

interface SignalCardProps {
  signal: TradeSetup;
  isLive?: boolean;
  rank?: number;
  /** Epoch ms of the last scan — used to replay a subtle refresh flash. */
  scanTime?: number | null;
}

const TRADE_LABELS: Record<TradeType, { label: string; dot: string; text: string; chip: string }> = {
  OVER_3: { label: 'Over 3', dot: 'bg-emerald-400', text: 'text-emerald-300', chip: 'bg-emerald-400/10 border-emerald-400/20' },
  UNDER_6: { label: 'Under 6', dot: 'bg-emerald-400', text: 'text-emerald-300', chip: 'bg-emerald-400/10 border-emerald-400/20' },
  OVER_2: { label: 'Over 2', dot: 'bg-amber-400', text: 'text-amber-300', chip: 'bg-amber-400/10 border-amber-400/20' },
  UNDER_7: { label: 'Under 7', dot: 'bg-amber-400', text: 'text-amber-300', chip: 'bg-amber-400/10 border-amber-400/20' },
};

const STATUS_BADGES: Record<string, { label: string; orb: 'ok' | 'warn' | 'error' | 'idle'; cls: string; ping: boolean }> = {
  pending: { label: 'Pending', orb: 'idle', cls: 'text-dark-200 bg-[var(--chip-bg)] border-[var(--chip-border)]', ping: false },
  watching_entry: { label: 'Watching Entry', orb: 'ok', cls: 'text-sky-300 bg-sky-400/10 border-sky-400/20', ping: true },
  watching_confirmation: { label: 'Watching Confirm', orb: 'warn', cls: 'text-amber-300 bg-amber-400/10 border-amber-400/20', ping: true },
  confirmed: { label: 'Confirmed', orb: 'ok', cls: 'text-emerald-300 bg-emerald-400/15 border-emerald-400/40', ping: true },
  reset: { label: 'Reset', orb: 'idle', cls: 'text-dark-200 bg-[var(--chip-bg)] border-[var(--chip-border)]', ping: false },
};

export function SignalCard({ signal, isLive, rank, scanTime }: SignalCardProps) {
  const style = TRADE_LABELS[signal.tradeType];
  const statusBadge = STATUS_BADGES[signal.status] ?? STATUS_BADGES.pending;
  const isHighPayout = signal.tradeType === 'OVER_3' || signal.tradeType === 'UNDER_6';
  const isTop = rank === 1;
  const confirmed = signal.status === 'confirmed';

  if (!signal.passesFilter) return null;

  return (
    <div className={`card-hover rounded-2xl ${isTop ? 'top-border' : 'border border-[var(--chip-border)]'}`}>
      <div
        className={`relative overflow-hidden rounded-[19px] ${
          isTop ? 'bg-[var(--card-bg)]' : 'bg-[var(--card-bg-soft)] backdrop-blur-xl'
        } ${confirmed ? 'ring-1 ring-emerald-400/40 shadow-[0_0_34px_-10px_rgba(52,211,153,0.4)]' : ''}`}
      >
        <div key={scanTime ?? 'initial'} className="refresh-flash h-full">
          {/* Card header */}
          <div className="px-5 py-3 flex items-center justify-between border-b border-[var(--divider)]">
            <div className="flex items-center gap-2.5">
              {rank !== undefined && (
                <span
                  className={`text-[10px] font-extrabold font-mono px-1.5 py-0.5 rounded-md ${
                    rank === 1
                    ? 'bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 text-emerald-300 border border-emerald-400/30'
                    : rank === 2
                      ? 'bg-[var(--chip-bg)] text-dark-200 border border-[var(--chip-border)]'
                      : 'bg-[var(--chip-bg)] text-dark-400 border border-[var(--chip-border)]'
                  }`}
                >
                  #{rank}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shadow-[0_0_8px_currentColor]`} />
                <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>
              </span>
              {isHighPayout && (
                <span className={`text-[9px] font-bold uppercase tracking-wider text-emerald-300 px-1.5 py-0.5 rounded-md ${style.chip}`}>
                  ✦ High
                </span>
              )}
              {signal.quietScore > 0 && (
                <span className="text-[10px] font-mono text-dark-200 bg-[var(--chip-bg)] px-1.5 py-0.5 rounded-md border border-[var(--chip-border)] tabular-nums">
                  {signal.quietScore.toFixed(1)}°
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(isLive || statusBadge.label !== 'Pending') && (
                <span className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${statusBadge.cls}`}>
                  <StatusOrb status={statusBadge.orb} ping={statusBadge.ping} size="sm" />
                  {statusBadge.label}
                </span>
              )}
            </div>
          </div>

          {/* Market info */}
          <div className="px-5 py-2.5 border-b border-[var(--divider)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-dark-100">{signal.marketDisplayName}</span>
              <span className="text-[10px] font-mono text-dark-300 bg-[var(--chip-bg)] px-1.5 py-0.5 rounded border border-[var(--chip-border)]">
                {signal.marketSymbol}
              </span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-dark-300 bg-[var(--chip-bg)] px-2 py-0.5 rounded-full border border-[var(--chip-border)]">
              {signal.market}
            </span>
          </div>

          {/* Entry & Confirmation */}
          <div className="px-5 py-3.5 border-b border-[var(--divider)]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-dark-300">Entry Digit</span>
                <div className="mt-1.5 flex items-center gap-2">
                  {signal.entryDigit !== null ? (
                    <span
                      key={signal.entryDigit}
                      className="value-pop inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400/15 to-cyan-400/10 border border-emerald-400/25 text-2xl font-extrabold font-mono text-emerald-300 shadow-[0_0_18px_-4px_rgba(52,211,153,0.4)]"
                    >
                      {signal.entryDigit}
                    </span>
                  ) : (
                    <span className="text-2xl font-bold font-mono text-dark-400">—</span>
                  )}
                  {signal.entryDigit !== null && (
                    <span className="text-[9px] text-dark-400 leading-tight">quietest<br />digit</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-dark-300">Confirm With</span>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {signal.validConfirmationDigits.map(d => (
                    <span
                      key={d}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-extrabold font-mono text-sky-300 bg-sky-400/10 border border-sky-400/20 transition-transform duration-200 hover:scale-110 hover:bg-sky-400/20"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {confirmed && signal.confirmationDigit !== null && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-400/10 to-cyan-500/15 border border-emerald-400/30 sheen text-center">
                <span className="text-xs font-bold text-emerald-300">
                  ✓ Confirmed — digit {signal.confirmationDigit} triggered
                </span>
              </div>
            )}
          </div>

          {/* Digit distribution */}
          <div className="px-5 py-3.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-dark-300 mb-2.5 block">Digit Distribution</span>
            <DigitDistribution
              digits={signal.allDigits?.length > 0 ? [...signal.allDigits].sort((a, b) => a.digit - b.digit) : []}
              tradeType={signal.tradeType}
              entryDigit={signal.entryDigit}
              quietDigits={signal.quietDigits}
              validConfirmationDigits={signal.validConfirmationDigits}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
