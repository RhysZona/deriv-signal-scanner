import { useState, useEffect } from 'react';
import type { TradeType } from '../types';

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
  // Live countdown timer – re-renders every second so "Xs ago" stays up-to-date.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="border-b border-dark-600 bg-dark-800/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Signal<span className="text-emerald-400">Scanner</span>
              </h1>
              <p className="text-xs text-dark-300 font-medium">Deriv Trading Signals</p>
            </div>
          </div>

          {/* Center: active trade badges */}
          <div className="hidden md:flex items-center gap-2">
            {(['OVER_3', 'UNDER_6', 'OVER_2', 'UNDER_7'] as TradeType[]).map((tt) => (
              <span
                key={tt}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${
                  tt === 'OVER_3' || tt === 'UNDER_6'
                    ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700/40'
                    : 'bg-amber-900/30 text-amber-400 border-amber-700/40'
                }`}
              >
                {tradeLabels[tt]}
                {(tt === 'OVER_3' || tt === 'UNDER_6') && (
                  <span className="ml-1 text-[9px] opacity-60">✦</span>
                )}
              </span>
            ))}
          </div>

          {/* Right: status */}
          <div className="flex items-center gap-4">
            {lastScanTime && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-dark-300">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTimeAgo(lastScanTime, now)}
              </div>
            )}

            {isReconnecting && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-900/20 border border-amber-700/30 animate-pulse">
                <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-[10px] font-semibold text-amber-400">Reconnecting</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
              connected
                ? feedDegraded
                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50 animate-pulse'
                  : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                : 'bg-red-500 shadow-sm shadow-red-500/50'
            }`} />
              <span className="text-xs font-medium text-dark-200 hidden sm:inline">
                {connected ? (feedDegraded ? 'Feed Issue' : 'Live') : 'Disconnected'}
              </span>
            </div>

            {totalSignals > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
                <span className="text-lg font-bold text-emerald-400">{totalSignals}</span>
                <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Signals</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function formatTimeAgo(timestamp: number, now: number): string {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
