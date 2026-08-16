import type { TradeSetup } from '../types';
import { GlassCard } from './GlassCard';

interface MarketOverviewProps {
  signals: TradeSetup[];
}

const FAMILY_META: Record<'Volatility' | 'Jump', { label: string; bar: string; text: string; chip: string }> = {
  Volatility: {
    label: 'Volatility',
    bar: 'bg-gradient-to-r from-sky-400/80 to-sky-500/50',
    text: 'text-sky-300',
    chip: 'bg-sky-400/8 border-sky-400/20',
  },
  Jump: {
    label: 'Jump',
    bar: 'bg-gradient-to-r from-violet-400/80 to-violet-500/50',
    text: 'text-violet-300',
    chip: 'bg-violet-400/8 border-violet-400/20',
  },
};

export function MarketOverview({ signals }: MarketOverviewProps) {
  const total = signals.length;
  const byFamily = (['Volatility', 'Jump'] as const).map((family) => ({
    family,
    count: signals.filter(s => s.market === family).length,
  }));

  // Per-symbol counts for the chip row (top markets by signal count).
  const perMarket = new Map<string, { name: string; count: number }>();
  for (const s of signals) {
    const entry = perMarket.get(s.marketSymbol) ?? { name: s.marketDisplayName, count: 0 };
    entry.count += 1;
    perMarket.set(s.marketSymbol, entry);
  }
  const topMarkets = [...perMarket.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4);

  return (
    <GlassCard className="px-5 py-4">
      <h3 className="text-xs font-bold text-dark-200 uppercase tracking-[0.14em] mb-4">Market Overview</h3>

      {/* Proportion bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-[var(--track-bg)] gap-px mb-3.5">
        {byFamily.map(({ family, count }) =>
          count > 0 ? (
            <div
              key={family}
              className={`${FAMILY_META[family].bar} transition-all duration-700`}
              style={{ width: `${(count / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      <div className="space-y-2.5 mb-4">
        {byFamily.map(({ family, count }) => {
          const meta = FAMILY_META[family];
          return (
            <div key={family} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${meta.bar.includes('sky') ? 'bg-sky-400' : 'bg-violet-400'} shadow-[0_0_6px_currentColor]`} />
                <span className="text-xs font-medium text-dark-100">{meta.label}</span>
              </div>
              <span className={`text-xs font-mono font-bold tabular-nums ${meta.text}`}>
                {count}
                <span className="text-[9px] text-dark-400 font-medium ml-1">/ {total}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Top markets by signal count */}
      {topMarkets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--divider)] pt-3">
          {topMarkets.map(([symbol, { name, count }]) => (
            <span
              key={symbol}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--chip-bg)] border border-[var(--chip-border)] text-[9px] font-medium text-dark-300"
              title={name}
            >
              <span className="font-mono font-bold text-dark-100">{symbol}</span>
              <span className="text-dark-400">×{count}</span>
            </span>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
