import type { TradeSetup } from '../types';

interface LiveMonitorProps {
  liveUpdates: TradeSetup[];
}

export function LiveMonitor({ liveUpdates }: LiveMonitorProps) {
  const active = liveUpdates.filter(
    u => u.status === 'watching_entry' || u.status === 'watching_confirmation',
  );

  if (active.length === 0) return null;

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">Live Monitor</h3>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-medium text-emerald-400">Watching {active.length}</span>
        </div>
      </div>

      <div className="space-y-2">
        {active.map((setup, i) => (
          <div
            key={`${setup.marketSymbol}-${setup.tradeType}`}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-dark-700 border border-dark-500"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white">{setup.marketDisplayName}</span>
              <span className="text-[9px] font-mono text-dark-400">{setup.marketSymbol}</span>
              <span className={`text-[10px] font-semibold ${
                setup.tradeType === 'OVER_3' || setup.tradeType === 'UNDER_6'
                  ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {setup.tradeType.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {setup.status === 'watching_entry' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-dark-300">Wait for</span>
                  <span className="text-sm font-bold font-mono text-blue-400">{setup.entryDigit}</span>
                </div>
              )}
              {setup.status === 'watching_confirmation' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-dark-300">Tick {setup.ticksSinceEntry}/2</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
