import type { TradeSetup, TradeType } from '../types';
import { SignalCard } from './SignalCard';

export type StrategyMode = 'over-under' | 'even-odd';

const OVER_UNDER_TYPES: TradeType[] = ['OVER_2', 'OVER_3', 'UNDER_6', 'UNDER_7'];
const EVEN_ODD_TYPES: TradeType[] = ['EVEN', 'ODD'];

function modeToTypes(mode: StrategyMode): TradeType[] {
  return mode === 'over-under' ? OVER_UNDER_TYPES : EVEN_ODD_TYPES;
}

interface SignalListProps {
  signals: TradeSetup[];
  liveUpdates: TradeSetup[] | null;
  lastScanTime: number | null;
  strategyMode: StrategyMode;
  onStrategyModeChange: (mode: StrategyMode) => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SignalList({ signals, liveUpdates, lastScanTime, strategyMode, onStrategyModeChange }: SignalListProps) {
  // Overlay live tick data onto the scan snapshot: for each ranked signal, use
  // the freshest live setup (updated percentages + FSM status) when available,
  // falling back to the scan's analysis snapshot.
  const liveByKey = new Map(
    (liveUpdates ?? []).map(u => [`${u.marketSymbol}-${u.tradeType}`, u]),
  );

  // Filter signals by the active strategy mode
  const activeTypes = modeToTypes(strategyMode);
  const filtered = signals.filter(s => activeTypes.includes(s.tradeType));

  return (
    <div className="lg:col-span-2 space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-dark-200 uppercase tracking-[0.14em] flex items-center gap-2">
          Ranked Signals
          <span className="px-1.5 py-0.5 rounded-md bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-[10px] font-mono tabular-nums">
            {filtered.length}
          </span>
        </h2>
        <div className="flex items-center gap-2 text-[11px] font-mono text-dark-400 tabular-nums">
          <span className="px-2 py-0.5 rounded-md bg-[var(--chip-bg)] border border-[var(--chip-border)]">
            {lastScanTime ? formatTime(lastScanTime) : '—'}
          </span>
        </div>
      </div>

      {/* Strategy tabs */}
      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--chip-bg)] border border-[var(--chip-border)]">
        <button
          onClick={() => onStrategyModeChange('over-under')}
          className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
            strategyMode === 'over-under'
              ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/25 shadow-[0_0_12px_-4px_rgba(52,211,153,0.3)]'
              : 'text-dark-300 hover:text-dark-200 border border-transparent'
          }`}
        >
          Over / Under
        </button>
        <button
          onClick={() => onStrategyModeChange('even-odd')}
          className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
            strategyMode === 'even-odd'
              ? 'bg-blue-400/15 text-blue-300 border border-blue-400/25 shadow-[0_0_12px_-4px_rgba(96,165,250,0.3)]'
              : 'text-dark-300 hover:text-dark-200 border border-transparent'
          }`}
        >
          Even / Odd
        </button>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <span className="text-sm text-dark-300">
              No {strategyMode === 'over-under' ? 'Over/Under' : 'Even/Odd'} signals detected
            </span>
          </div>
        )}
        {filtered.map((signal, i) => {
          const live = liveByKey.get(`${signal.marketSymbol}-${signal.tradeType}`);
          // Live overlay updates percentages and status, but never overrides the
          // scan snapshot's passesFilter — the header count and grid visibility
          // are driven by the scan result, so a live re-analysis that drifts
          // above the quiet threshold should not make the card vanish mid-cycle.
          const merged = live ? { ...live, passesFilter: signal.passesFilter } : signal;
          return (
            <SignalCard
              key={`${signal.marketSymbol}-${signal.tradeType}`}
              signal={merged}
              rank={i + 1}
              scanTime={lastScanTime}
              isLive={!!live}
            />
          );
        })}
      </div>
    </div>
  );
}
