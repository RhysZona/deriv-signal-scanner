import { useState, useCallback, useEffect } from 'react';
import { useSignals } from './hooks/useSignals';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ToastProvider } from './components/Toast';
import { runAnalyticsEngine } from './lib/analyticsEngine';
import { RingBuffer } from './lib/ringBuffer';
import type { AnalyticsEngineOutput, ConnectionStatus, DerivAccountInfo, WindowConfig } from './types';

export default function App() {
  const {
    connected,
    feedDegraded,
    scanResult,
    liveUpdates,
    lastScanTime,
    totalSignals,
    marketsCount,
    traderState,
    tradeHistory,
    isReconnecting,
    traderTradeCount,
    availableMarkets,
  } = useSignals();

  // ── Connection state (for DerivAuth component) ───────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    authorized: false,
    account: null,
    feedDegraded: false,
  });

  // ── Market/Window state ──────────────────────────────────────────────────
  const [selectedMarket, setSelectedMarket] = useState(
    availableMarkets.length > 0 ? availableMarkets[0].symbol : '1HZ100V',
  );
  const [windowConfig, setWindowConfig] = useState<WindowConfig>({
    slowWindowSize: 1000,
    fastWindowSize: 50,
  });
  const [slowBuffer] = useState(() => new RingBuffer<{ price: number; digit: number; epoch: number }>(1000));
  const [fastBuffer, setFastBuffer] = useState(() => new RingBuffer<{ price: number; digit: number; epoch: number }>(50));

  // ── Derived state ────────────────────────────────────────────────────────
  const lastTick = slowBuffer.peek();
  const lastPrice = lastTick?.price ?? null;
  const lastDigit = lastTick?.digit ?? null;
  const slowWindowDigits = slowBuffer.toArray().map((t) => t.digit);
  const fastWindowDigits = fastBuffer.toArray().map((t) => t.digit);

  // Compute digit stats for both windows (used by DigitBarChart)
  const computeDigitStats = (digits: number[]) => {
    if (digits.length === 0) return [];
    const counts = new Array(10).fill(0);
    for (const d of digits) counts[d]++;
    return counts.map((count, digit) => ({
      digit,
      count,
      percentage: (count / digits.length) * 100,
    }));
  };
  const slowDigitStats = computeDigitStats(slowWindowDigits);
  const fastDigitStats = computeDigitStats(fastWindowDigits);

  // ── Analytics Engine ─────────────────────────────────────────────────────
  const [analytics, setAnalytics] = useState<AnalyticsEngineOutput | null>(null);
  const [prevWeights, setPrevWeights] = useState<Record<string, number> | undefined>(undefined);

  // Compute analytics whenever the slow window changes enough
  const computeAnalytics = useCallback((digits: number[]) => {
    if (digits.length < 10) return;
    const counts = new Array(10).fill(0);
    for (const d of digits) counts[d]++;
    const digitStats = counts.map((count, digit) => ({
      digit,
      count,
      percentage: (count / digits.length) * 100,
    }));
    const result = runAnalyticsEngine(digitStats, digits, prevWeights);
    setAnalytics(result);
    setConnectionStatus((prev) => ({ ...prev, feedDegraded: false }));
  }, [prevWeights]);

  // Trigger analytics engine when slow window digit count changes
  useEffect(() => {
    if (slowWindowDigits.length >= 10) {
      const timer = setTimeout(() => computeAnalytics(slowWindowDigits), 100);
      return () => clearTimeout(timer);
    }
  }, [slowWindowDigits.length, computeAnalytics]);

  // ── Event handlers ───────────────────────────────────────────────────────
  const handleMarketChange = useCallback((symbol: string) => {
    setSelectedMarket(symbol);
    slowBuffer.clear();
    fastBuffer.clear();
  }, [slowBuffer, fastBuffer]);

  const handleFastWindowResize = useCallback((size: number) => {
    const clamped = Math.max(10, Math.min(size, 500));
    setWindowConfig((prev) => ({ ...prev, fastWindowSize: clamped }));
    const newFast = fastBuffer.resize(clamped);
    setFastBuffer(newFast);
  }, [fastBuffer]);

  const handleTokenSubmit = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.status === 'ok' && data.account) {
        setConnectionStatus({
          connected: true,
          authorized: true,
          account: data.account,
          feedDegraded: false,
        });
      } else {
        console.error('[App] Token auth failed:', data.error);
      }
    } catch (e: any) {
      console.error('[App] Token submission error:', e?.message);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      await fetch('/api/auth/disconnect', { method: 'POST' });
    } catch {
      // best-effort
    }
    setConnectionStatus({
      connected: false,
      authorized: false,
      account: null,
      feedDegraded: false,
    });
  }, []);

  const handleRecalibrate = useCallback(() => {
    if (traderTradeCount < 200) return;
    // Trigger weight recalibration — in future, this will call server endpoint
    // and update prevWeights with exponential smoothing
    console.log('[App] Recalibrating weights...');
  }, [traderTradeCount]);

  // Update connection status from hook
  useEffect(() => {
    setConnectionStatus((prev) => ({
      ...prev,
      connected,
      feedDegraded,
    }));
  }, [connected, feedDegraded]);

  return (
    <ToastProvider>
    <div className="min-h-screen bg-dark-900">
      {/* Scan line animation */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]">
        <div className="scan-line w-full h-px bg-emerald-500" />
      </div>

      <Header
        connectionStatus={connectionStatus}
        availableMarkets={availableMarkets}
        selectedMarket={selectedMarket}
        lastPrice={lastPrice}
        lastDigit={lastDigit}
        windowConfig={windowConfig}
        totalSignals={totalSignals}
        slowWindowDigits={slowWindowDigits}
        fastWindowDigits={fastWindowDigits}
        onMarketChange={handleMarketChange}
        onFastWindowResize={handleFastWindowResize}
      />

      <main className="relative z-10">
        <Dashboard
          connected={connected}
          feedDegraded={feedDegraded}
          scanResult={scanResult}
          liveUpdates={liveUpdates}
          lastScanTime={lastScanTime}
          marketsCount={marketsCount}
          traderState={traderState}
          tradeHistory={tradeHistory}
          availableMarkets={availableMarkets}
          selectedMarket={selectedMarket}
          connectionStatus={connectionStatus}
          lastPrice={lastPrice}
          lastDigit={lastDigit}
          windowConfig={windowConfig}
          analytics={analytics}
          slowWindowDigits={slowWindowDigits}
          fastWindowDigits={fastWindowDigits}
          slowDigitStats={slowDigitStats}
          fastDigitStats={fastDigitStats}
          tradeCount={traderTradeCount}
          calibrationLocked={traderTradeCount < 200}
          calibrationReason={
            traderTradeCount < 200
              ? `Need ${200 - traderTradeCount} more trades — calibration locked`
              : ''
          }
          onMarketChange={handleMarketChange}
          onFastWindowResize={handleFastWindowResize}
          onTokenSubmit={handleTokenSubmit}
          onDisconnect={handleDisconnect}
          onRecalibrate={handleRecalibrate}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-700 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-[10px] text-dark-400">
            <span>Deriv Signal Lab v2.0</span>
            <span>Powered by Deriv API · Forward Telemetry Laboratory</span>
          </div>
        </div>
      </footer>
    </div>
    </ToastProvider>
  );
}
