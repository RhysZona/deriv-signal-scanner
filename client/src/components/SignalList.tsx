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
    <div className="lg:col-span-2 xl:col-span-1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">
          Ranked Signals
        </h2>
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <span>{signals.length} found</span>
          <span className="text-dark-600">·</span>
          <span>{lastScanTime ? formatTime(lastScanTime) : '—'}</span>
        </div>
      </div>
      <div className="space-y-4">
        {signals.map((signal, i) => (
          <SignalCard
            key={`${signal.marketSymbol}-${signal.tradeType}`}
            signal={signal}
            rank={i + 1}
            isLive={liveUpdates?.some(
              u => u.marketSymbol === signal.marketSymbol && u.tradeType === signal.tradeType,
            )}
          />
        ))}
      </div>
    </div>
  );
}
