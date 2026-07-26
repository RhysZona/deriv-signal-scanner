import type { TradeSetup } from '../types';

interface MarketOverviewProps {
  signals: TradeSetup[];
}

export function MarketOverview({ signals }: MarketOverviewProps) {
  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-4">
        Market Overview
      </h3>
      <div className="space-y-2.5">
        {(['Volatility', 'Jump'] as const).map((marketType) => {
          const count = signals.filter(s => s.market === marketType).length;
          return (
            <div key={marketType} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${marketType === 'Volatility' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                <span className="text-xs font-medium text-dark-200">{marketType}</span>
              </div>
              <span className="text-xs font-mono font-bold text-dark-300">
                {count} signal{count !== 1 ? 's' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
