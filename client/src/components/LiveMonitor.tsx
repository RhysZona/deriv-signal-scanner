import type { TradeSetup } from '../types';
import { GlassCard } from './GlassCard';

interface LiveMonitorProps {
  liveUpdates: TradeSetup[];
}

const CONFIRM_WINDOW = 2; // confirmWithinTicks

export function LiveMonitor({ liveUpdates }: LiveMonitorProps) {
  const active = liveUpdates.filter(
    u => u.status === 'watching_entry' || u.status === 'watching_confirmation',
  );

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
            Watching {active.length}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {active.map((setup) => (
          <LiveRow key={`${setup.marketSymbol}-${setup.tradeType}-${setup.status}`} setup={setup} />
        ))}
      </div>
    </GlassCard>
  );
}

function LiveRow({ setup }: { setup: TradeSetup }) {
  const high = setup.tradeType === 'OVER_3' || setup.tradeType === 'UNDER_6';
  const tradeColor = high ? 'text-emerald-300' : 'text-amber-300';

  return (
    <div className="animate-fade-in-up flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] transition-colors hover:border-white/[0.12]">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="truncate text-xs font-semibold text-white">{setup.marketDisplayName}</span>
        <span className="text-[9px] font-mono text-dark-300 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] shrink-0">
          {setup.marketSymbol}
        </span>
        <span className={`text-[10px] font-bold uppercase shrink-0 ${tradeColor}`}>
          {setup.tradeType.replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {setup.status === 'watching_entry' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-dark-300">Wait for</span>
            <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-lg bg-sky-400/10 border border-sky-400/30 text-sm font-extrabold font-mono text-sky-300">
              {setup.entryDigit}
              <span className="absolute inset-0 rounded-lg border border-sky-400/40 animate-ping opacity-40" />
            </span>
          </div>
        )}
        {setup.status === 'watching_confirmation' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-dark-300">Confirm</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: CONFIRM_WINDOW }).map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < setup.ticksSinceEntry
                      ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                      : 'bg-white/[0.08]'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
