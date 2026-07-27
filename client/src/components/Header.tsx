import { useState, useEffect } from 'react';
import type { MarketSymbol, ConnectionStatus, WindowConfig } from '../types';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  availableMarkets: MarketSymbol[];
  selectedMarket: string;
  lastPrice: number | null;
  lastDigit: number | null;
  windowConfig: WindowConfig;
  totalSignals: number;
  slowWindowDigits: number[];
  fastWindowDigits: number[];
  onMarketChange: (symbol: string) => void;
  onFastWindowResize: (size: number) => void;
}

export function Header({
  connectionStatus,
  availableMarkets,
  selectedMarket,
  lastPrice,
  lastDigit,
  windowConfig,
  totalSignals,
  slowWindowDigits,
  fastWindowDigits,
  onMarketChange,
  onFastWindowResize,
}: HeaderProps) {
  const [now, setNow] = useState(Date.now());
  const [fastInput, setFastInput] = useState(String(windowConfig.fastWindowSize));
  const [showFastInput, setShowFastInput] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const volMarkets = availableMarkets.filter((m) => m.market === 'Volatility');
  const jumpMarkets = availableMarkets.filter((m) => m.market === 'Jump');

  return (
    <header className="border-b border-dark-600 bg-dark-800/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top row */}
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Signal<span className="text-emerald-400">Lab</span>
              </h1>
              <p className="text-[9px] text-dark-400 font-medium">Forward Telemetry Laboratory</p>
            </div>
          </div>

          {/* Market Selector */}
          <div className="flex items-center gap-2 flex-1 px-4">
            <select
              value={selectedMarket}
              onChange={(e) => onMarketChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-500 text-xs font-medium text-dark-100 outline-none hover:border-dark-400 focus:border-emerald-700/50 transition-colors cursor-pointer"
            >
              <optgroup label="Volatility">
                {volMarkets.map((m) => (
                  <option key={m.symbol} value={m.symbol}>{m.displayName}</option>
                ))}
              </optgroup>
              <optgroup label="Jump">
                {jumpMarkets.map((m) => (
                  <option key={m.symbol} value={m.symbol}>{m.displayName}</option>
                ))}
              </optgroup>
            </select>

            {/* Price & Last Digit */}
            <div className="hidden md:flex items-center gap-2">
              <div className="px-2 py-1 rounded bg-dark-700 border border-dark-500">
                <span className="text-[9px] text-dark-400 mr-1">Price</span>
                <span className="text-xs font-bold font-mono text-white">
                  {lastPrice?.toFixed(2) ?? '—'}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-dark-700 border border-dark-500">
                <span className="text-[9px] text-dark-400 mr-1">Digit</span>
                <span className={`text-xs font-bold font-mono ${
                  lastDigit !== null
                    ? lastDigit % 2 === 0 ? 'text-blue-400' : 'text-amber-400'
                    : 'text-dark-400'
                }`}>
                  {lastDigit !== null ? lastDigit : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: connection + signals */}
          <div className="flex items-center gap-3">
            {/* Connection badge */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
              connectionStatus.connected
                ? connectionStatus.authorized
                  ? 'bg-emerald-900/20 border-emerald-700/30'
                  : 'bg-amber-900/20 border-amber-700/30'
                : 'bg-red-900/20 border-red-700/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus.connected
                  ? connectionStatus.authorized
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : 'bg-amber-500 animate-pulse'
                  : 'bg-red-500'
              }`} />
              <span className="text-[9px] font-semibold text-dark-200 uppercase">
                {connectionStatus.connected
                  ? connectionStatus.authorized ? 'Connected' : 'Unauth'
                  : 'Offline'}
              </span>
              {/* Demo/Real badge */}
              {connectionStatus.authorized && connectionStatus.account && (
                <span className={`ml-1 text-[8px] font-bold px-1 py-0.5 rounded ${
                  connectionStatus.account.isVirtual
                    ? 'text-blue-400 bg-blue-900/20'
                    : 'text-amber-400 bg-amber-900/20'
                }`}>
                  {connectionStatus.account.isVirtual ? 'DEMO' : 'REAL'}
                </span>
              )}
            </div>

            {/* Signal count */}
            {totalSignals > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
                <span className="text-sm font-bold text-emerald-400">{totalSignals}</span>
                <span className="text-[9px] font-medium text-emerald-500 uppercase tracking-wider hidden sm:inline">Signals</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: Window controls */}
        <div className="flex items-center gap-4 pb-2.5 text-[10px]">
          <div className="flex items-center gap-1.5 text-dark-400">
            <span>Slow Window:</span>
            <span className="font-mono font-bold text-dark-200">{slowWindowDigits.length} ticks</span>
          </div>
          <div className="flex items-center gap-1.5 text-dark-400">
            <span>Fast Window:</span>
            {showFastInput ? (
              <input
                type="number"
                min={10}
                max={500}
                value={fastInput}
                onChange={(e) => setFastInput(e.target.value)}
                onBlur={() => {
                  const v = parseInt(fastInput, 10);
                  if (!isNaN(v) && v >= 10) {
                    onFastWindowResize(v);
                  }
                  setShowFastInput(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === 'Escape') setShowFastInput(false);
                }}
                autoFocus
                className="w-14 px-1.5 py-0.5 rounded bg-dark-700 border border-dark-500 text-[10px] font-mono font-bold text-dark-200 focus:outline-none focus:border-emerald-700/40"
              />
            ) : (
              <button
                onClick={() => {
                  setFastInput(String(windowConfig.fastWindowSize));
                  setShowFastInput(true);
                }}
                className="font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-text"
              >
                {windowConfig.fastWindowSize} ticks
              </button>
            )}
            <span className="text-dark-500">(min 10)</span>
          </div>
          <div className="flex items-center gap-1 ml-auto text-dark-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono">{formatTime(now)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function formatTime(now: number): string {
  return new Date(now).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
