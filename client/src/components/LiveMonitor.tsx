import type { TradeSetup, TradeType } from '../types';
import { GlassCard } from './GlassCard';
import { useNow } from '../hooks/useNow';
import type { StrategyMode } from './SignalList';

const OVER_UNDER_TYPES: TradeType[] = ['OVER_2', 'OVER_3', 'UNDER_6', 'UNDER_7'];
const EVEN_ODD_TYPES: TradeType[] = ['EVEN', 'ODD'];

interface LiveMonitorProps {
  liveUpdates: TradeSetup[];
  strategyMode: StrategyMode;
}

/** How long the entry-digit "seen" pulse stays lit (ms). */
const SEEN_PULSE_MS = 4_000;

export function LiveMonitor({ liveUpdates, strategyMode }: LiveMonitorProps) {
  // Fast-ish ticker so the "seen" pulse fades on its own without new SSE events.
  const now = useNow(200);

  // Filter by active strategy mode
  const activeTypes = strategyMode === 'over-under' ? OVER_UNDER_TYPES : EVEN_ODD_TYPES;
  // Signal-only: we present the entry instruction and never confirm, so only
  // watching_entry setups are shown here.
  const active = liveUpdates.filter(u => u.status === 'watching_entry' && activeTypes.includes(u.tradeType));

  if (active.length === 0) return null;

  return (
    <GlassCard className="px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-dark-200 uppercase tracking-[0.14em]">Live Monitor</h3>
        <div className="flex items-center gap-2">
          {/* Equalizer — only animates while the feed is truly live */}
          <div className="flex items-end gap-[2.5px] h-3" aria-hidden>
            <span className="eq-bar w-[2.5px] h-full rounded-sm bg-emerald-400" style={{ animationDelay: '0ms' }} />
            <span className="eq-bar w-[2.5px] h-full rounded-sm bg-emerald-400" style={{ animationDelay: '180ms' }} />
            <span className="eq-bar w-[2.5px] h-full rounded-sm bg-emerald-400" style={{ animationDelay: '360ms' }} />
          </div>
          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
            Waiting {active.length}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {active.map((setup) => (
          <LiveRow key={`${setup.marketSymbol}-${setup.tradeType}`} setup={setup} now={now} />
        ))}
      </div>
    </GlassCard>
  );
}

function LiveRow({ setup, now }: { setup: TradeSetup; now: number }) {
  const high = setup.tradeType === 'OVER_3' || setup.tradeType === 'UNDER_6' || setup.tradeType === 'EVEN' || setup.tradeType === 'ODD';
  const tradeColor = high ? 'text-emerald-300' : 'text-amber-300';
  const seen = setup.entryTriggeredAt !== null && now - setup.entryTriggeredAt < SEEN_PULSE_MS;

  return (
    <div
      className={`animate-fade-in-up flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${
        seen
          ? 'bg-emerald-400/[0.08] border-emerald-400/40'
          : 'bg-[var(--chip-bg)] border-[var(--chip-border)] hover:border-[var(--glass-border-hover)]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="truncate text-xs font-semibold text-dark-100">{setup.marketDisplayName}</span>
        <span className="text-[9px] font-mono text-dark-300 bg-[var(--chip-bg)] px-1.5 py-0.5 rounded border border-[var(--chip-border)] shrink-0">
          {setup.marketSymbol}
        </span>
        <span className={`text-[10px] font-bold uppercase shrink-0 ${tradeColor}`}>
          {setup.tradeType.replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${seen ? 'text-emerald-300' : 'text-dark-300'}`}>
          {seen ? '✓ Seen' : 'Wait for'}
        </span>
        <span
          className={`relative inline-flex items-center justify-center w-7 h-7 rounded-lg border text-sm font-extrabold font-mono transition-colors ${
            seen
              ? 'bg-emerald-400/15 border-emerald-400/50 text-emerald-300'
              : 'bg-sky-400/10 border-sky-400/30 text-sky-300'
          }`}
        >
          {setup.entryDigit}
          <span
            className={`absolute inset-0 rounded-lg border animate-ping opacity-40 ${
              seen ? 'border-emerald-400/50' : 'border-sky-400/40'
            }`}
          />
        </span>
      </div>
    </div>
  );
}
