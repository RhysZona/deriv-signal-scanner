import { useRef, useEffect } from 'react';
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
  EVEN: { label: 'Even', dot: 'bg-blue-400', text: 'text-blue-300', chip: 'bg-blue-400/10 border-blue-400/20' },
  ODD: { label: 'Odd', dot: 'bg-violet-400', text: 'text-violet-300', chip: 'bg-violet-400/10 border-violet-400/20' },
};

const STATUS_BADGES: Record<string, { label: string; orb: 'ok' | 'warn' | 'error' | 'idle'; cls: string; ping: boolean }> = {
  pending: { label: 'Pending', orb: 'idle', cls: 'text-dark-200 bg-[var(--chip-bg)] border-[var(--chip-border)]', ping: false },
  watching_entry: { label: 'Watching Entry', orb: 'ok', cls: 'text-sky-300 bg-sky-400/10 border-sky-400/20', ping: true },
};

export function SignalCard({ signal, isLive, rank, scanTime }: SignalCardProps) {
  const style = TRADE_LABELS[signal.tradeType];
  const statusBadge = STATUS_BADGES[signal.status] ?? STATUS_BADGES.pending;
  const isHighPayout = signal.tradeType === 'OVER_3' || signal.tradeType === 'UNDER_6' || signal.tradeType === 'EVEN' || signal.tradeType === 'ODD';
  const isTop = rank === 1;

  // Retrigger the refresh-flash animation on each new scan without remounting
  // the DOM (the old key-based approach tore down the entire card subtree,
  // resetting useCountUp bars to 0 and replaying value-pop on every scan).
  const flashRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = flashRef.current;
    if (!el || scanTime == null) return;
    el.classList.remove('refresh-flash');
    void el.offsetHeight; // force reflow so the animation restarts
    el.classList.add('refresh-flash');
  }, [scanTime]);

  if (!signal.passesFilter) return null;

  return (
    <div className={`card-hover group rounded-2xl ${isTop ? 'top-border' : 'border border-[var(--chip-border)]'}`}>
      <div className="relative overflow-hidden rounded-[19px] bg-[var(--card-bg)]">
        <div ref={flashRef} className="refresh-flash h-full">
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

          {/* Entry instruction (signal-only — we never confirm, just wait for the digit) */}
          <div className="px-5 py-3.5 border-b border-[var(--divider)] grid grid-cols-2 gap-4">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-dark-300">Entry</span>
              <div className="mt-1.5 flex items-center gap-2">
                {signal.entryDigit !== null ? (() => {
                  const isEO = signal.tradeType === 'EVEN' || signal.tradeType === 'ODD';
                  return (
                    <span
                      key={signal.entryDigit}
                      className={`value-pop inline-flex items-center justify-center w-11 h-11 rounded-xl text-2xl font-extrabold font-mono transition-[box-shadow,border-color] duration-300 ${
                        isEO
                          ? 'bg-gradient-to-br from-amber-400/15 to-amber-300/10 border border-amber-400/25 text-amber-300 shadow-[0_0_18px_-4px_rgba(251,191,36,0.4)] group-hover:shadow-[0_0_28px_-2px_rgba(251,191,36,0.7)] group-hover:border-amber-400/60'
                          : 'bg-gradient-to-br from-emerald-400/15 to-cyan-400/10 border border-emerald-400/25 text-emerald-300 shadow-[0_0_18px_-4px_rgba(52,211,153,0.4)] group-hover:shadow-[0_0_28px_-2px_rgba(52,211,153,0.7)] group-hover:border-emerald-400/60'
                      }`}
                    >
                      {signal.entryDigit}
                    </span>
                  );
                })()
                ) : (
                  <span className="text-2xl font-bold font-mono text-dark-400">—</span>
                )}
                {signal.entryDigit !== null && (
                  <span className="text-[9px] text-dark-400 leading-tight">{signal.tradeType === 'EVEN' ? 'least odd' : signal.tradeType === 'ODD' ? 'least even' : 'quietest\ndigit'}</span>
                )}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-dark-300">Confirm</span>
              <div className="mt-1.5">
                {signal.confirmationText ? (
                  <span className="text-[10px] text-dark-300 leading-tight block">{signal.confirmationText}</span>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap">
                    {signal.validConfirmationDigits.map(d => (
                      <span
                        key={d}
                        className="text-xs font-mono font-bold text-sky-300 bg-sky-400/10 border border-sky-400/20 px-1.5 py-0.5 rounded-md tabular-nums transition-colors duration-300 group-hover:bg-sky-400/20 group-hover:border-sky-400/40"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Digit distribution */}
          <div className="px-5 py-3.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-dark-300 mb-2.5 block">Digit Distribution</span>
            <DigitDistribution
              digits={signal.allDigits?.length > 0 ? [...signal.allDigits].sort((a, b) => a.digit - b.digit) : []}
              tradeType={signal.tradeType}
              entryDigit={signal.entryDigit}
              quietDigits={signal.quietDigits}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
