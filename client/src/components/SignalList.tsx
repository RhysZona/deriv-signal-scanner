import type { TradeSetup } from '../types';
import { SignalCard } from './SignalCard';

interface SignalListProps {
  signals: TradeSetup[];
  liveUpdates: TradeSetup[] | null;
  lastScanTime: number | null;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SignalList({ signals, liveUpdates, lastScanTime }: SignalListProps) {
  return (
    <div className="lg:col-span-2 space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-dark-200 uppercase tracking-[0.14em] flex items-center gap-2">
          Ranked Signals
          <span className="px-1.5 py-0.5 rounded-md bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-[10px] font-mono tabular-nums">
            {signals.length}
          </span>
        </h2>
        <div className="flex items-center gap-2 text-[11px] font-mono text-dark-400 tabular-nums">
          <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
            {lastScanTime ? formatTime(lastScanTime) : '—'}
          </span>
        </div>
      </div>
      <div className="space-y-4">
        {signals.map((signal, i) => (
          <SignalCard
            key={`${signal.marketSymbol}-${signal.tradeType}`}
            signal={signal}
            rank={i + 1}
            scanTime={lastScanTime}
            isLive={liveUpdates?.some(
              u => u.marketSymbol === signal.marketSymbol && u.tradeType === signal.tradeType,
            )}
          />
        ))}
      </div>
    </div>
  );
}
