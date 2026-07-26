import type { TradeRecord } from '../types';

interface TradeHistoryProps {
  trades: TradeRecord[];
}

const STATUS_STYLES: Record<string, { label: string; color: string; dot: string }> = {
  placed: { label: 'Placed', color: 'text-blue-400 bg-blue-500/10', dot: 'bg-blue-400' },
  won: { label: 'Won', color: 'text-emerald-400 bg-emerald-500/10', dot: 'bg-emerald-400' },
  lost: { label: 'Lost', color: 'text-red-400 bg-red-500/10', dot: 'bg-red-400' },
  error: { label: 'Error', color: 'text-red-400 bg-red-500/10', dot: 'bg-red-400' },
  dry_run: { label: 'Dry Run', color: 'text-dark-400 bg-dark-600', dot: 'bg-dark-400' },
};

export function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) return null;

  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">Trade History</h3>
        <span className="text-[10px] font-medium text-dark-400">{trades.length} recent</span>
      </div>

      <div className="space-y-1.5 max-h-[320px] overflow-y-auto scrollbar-thin pr-1">
        {trades.map((trade) => {
          const style = STATUS_STYLES[trade.status] ?? STATUS_STYLES.placed;
          const isLoss = trade.profit != null && trade.profit < 0;
          const isWin = trade.profit != null && trade.profit >= 0;

          return (
            <div
              key={trade.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500 hover:border-dark-400 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-white truncate">
                      {trade.displayName || trade.symbol}
                    </span>
                    <span className="text-[9px] font-mono text-dark-400 shrink-0">{trade.contractType}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-dark-400">
                    <span>{trade.barrier}</span>
                    <span>{trade.durationTicks}t</span>
                    <span>${trade.stake.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isWin && (
                  <span className="text-[11px] font-bold font-mono text-emerald-400">
                    +${trade.profit!.toFixed(2)}
                  </span>
                )}
                {isLoss && (
                  <span className="text-[11px] font-bold font-mono text-red-400">
                    ${trade.profit!.toFixed(2)}
                  </span>
                )}
                {trade.status === 'dry_run' && (
                  <span className="text-[9px] font-medium text-dark-400 border border-dark-500 px-1.5 py-0.5 rounded">
                    DRY
                  </span>
                )}
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${style.color}`}>
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
