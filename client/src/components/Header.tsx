import type { TradeType } from '../types';
import { LiveConfigIndicator } from './LiveConfigIndicator';
import { StatusOrb } from './StatusOrb';
import { formatTimeAgo } from '../lib/time';
import { useNow } from '../hooks/useNow';
import { useCountUp } from '../hooks/useCountUp';

interface HeaderProps {
  connected: boolean;
  feedDegraded: boolean;
  isReconnecting: boolean;
  lastScanTime: number | null;
  totalSignals: number;
}

const tradeLabels: Record<TradeType, string> = {
  OVER_2: 'O2',
  OVER_3: 'O3',
  UNDER_6: 'U6',
  UNDER_7: 'U7',
};

export function Header({ connected, feedDegraded, isReconnecting, lastScanTime, totalSignals }: HeaderProps) {
  const now = useNow(1000);
  const signalCount = Math.round(useCountUp(totalSignals));
  const feedStatus: 'ok' | 'warn' | 'error' = !connected ? 'error' : feedDegraded ? 'warn' : 'ok';

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08080f]/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 overflow-hidden">
                <svg className="w-5 h-5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  <path strokeLinecap="round" d="M3 21h18" opacity={0.4} />
                </svg>
              </div>
              {connected && (
                <StatusOrb status={feedStatus} ping={feedStatus === 'ok'} className="absolute -bottom-0.5 -right-0.5 !w-2.5 !h-2.5 ring-2 ring-[#08080f]" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-none">
                Signal<span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Scanner</span>
              </h1>
              <p className="text-[11px] text-dark-300 font-medium mt-0.5">Deriv Trading Signals</p>
            </div>
          </div>

          {/* Center: active trade badges */}
          <div className="hidden md:flex items-center gap-2">
            {(['OVER_3', 'UNDER_6', 'OVER_2', 'UNDER_7'] as TradeType[]).map((tt) => {
              const high = tt === 'OVER_3' || tt === 'UNDER_6';
              return (
                <span
                  key={tt}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border backdrop-blur ${
                    high
                      ? 'bg-emerald-400/[0.08] text-emerald-300 border-emerald-400/20'
                      : 'bg-amber-400/[0.08] text-amber-300 border-amber-400/20'
                  }`}
                >
                  <span className={`w-1 h-1 rounded-full ${high ? 'bg-emerald-400' : 'bg-amber-400'} shadow-[0_0_6px_currentColor]`} />
                  {tradeLabels[tt]}
                </span>
              );
            })}
          </div>

          {/* Right: status */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live clock */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-dark-300 tabular-nums">
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {new Date(now).toLocaleTimeString('en-US', { hour12: false })}
            </div>

            {lastScanTime && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-dark-300">
                <span className="text-[10px] uppercase tracking-wider text-dark-400">{formatTimeAgo(lastScanTime, now)}</span>
              </div>
            )}

            <LiveConfigIndicator />

            {isReconnecting && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-400/[0.08] border border-amber-400/20 animate-pulse">
                <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-[10px] font-semibold text-amber-400">Reconnecting</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <StatusOrb status={feedStatus} ping={feedStatus !== 'error'} />
              <span className="text-xs font-semibold text-dark-100 hidden sm:inline">
                {connected ? (feedDegraded ? 'Feed Issue' : 'Live') : 'Disconnected'}
              </span>
            </div>

            {totalSignals > 0 && (
              <div className="flex items-baseline gap-1.5 px-3 py-1 rounded-xl bg-emerald-400/[0.08] border border-emerald-400/25">
                <span className="text-lg font-extrabold text-emerald-300 font-mono tabular-nums leading-none">{signalCount}</span>
                <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">Signals</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
