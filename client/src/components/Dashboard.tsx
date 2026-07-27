import type { ScanResult, TradeSetup, TraderState, TradeRecord, MarketSymbol, ConnectionStatus, AnalyticsEngineOutput, WindowConfig, DigitStats } from '../types';
import { EmptyState } from './EmptyState';
import { SignalList } from './SignalList';
import { SidePanel } from './SidePanel';
import { DigitBarChart } from './DigitBarChart';

interface DashboardProps {
  connected: boolean;
  feedDegraded: boolean;
  scanResult: ScanResult | null;
  liveUpdates: TradeSetup[] | null;
  lastScanTime: number | null;
  marketsCount: number | null;
  traderState: TraderState | null;
  tradeHistory: TradeRecord[];
  availableMarkets: MarketSymbol[];
  selectedMarket: string;
  connectionStatus: ConnectionStatus;
  lastPrice: number | null;
  lastDigit: number | null;
  windowConfig: WindowConfig;
  analytics: AnalyticsEngineOutput | null;
  slowWindowDigits: number[];
  fastWindowDigits: number[];
  slowDigitStats: DigitStats[];
  fastDigitStats: DigitStats[];
  tradeCount: number;
  calibrationLocked: boolean;
  calibrationReason: string;
  onMarketChange: (symbol: string) => void;
  onFastWindowResize: (size: number) => void;
  onTokenSubmit: (token: string) => void;
  onDisconnect: () => void;
  onRecalibrate: () => void;
}

export function Dashboard({
  connected,
  feedDegraded,
  scanResult,
  liveUpdates,
  lastScanTime,
  marketsCount,
  traderState,
  tradeHistory,
  availableMarkets,
  selectedMarket,
  connectionStatus,
  lastPrice,
  lastDigit,
  windowConfig,
  analytics,
  slowWindowDigits,
  fastWindowDigits,
  tradeCount,
  calibrationLocked,
  calibrationReason,
  onMarketChange,
  onFastWindowResize,
  onTokenSubmit,
  onDisconnect,
  onRecalibrate,
  slowDigitStats,
  fastDigitStats,
}: DashboardProps) {
  const signals = scanResult?.rankedSignals ?? [];
  const hasSignals = signals.length > 0;

  if (!hasSignals) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EmptyState connected={connected} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Section 2/3: Slow & Fast Window Digit Bar Charts */}
      {slowDigitStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DigitBarChart
            label="Slow Window"
            digits={slowDigitStats}
            marketKey={selectedMarket}
            tickCount={slowWindowDigits.length}
          />
          <DigitBarChart
            label="Fast Window"
            digits={fastDigitStats}
            marketKey={selectedMarket}
            tickCount={fastWindowDigits.length}
          />
        </div>
      )}

      {/* Section 4+: Signal List + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SignalList
            signals={signals}
            liveUpdates={liveUpdates}
            lastScanTime={lastScanTime}
          />
        </div>

        <div className="lg:col-span-1 space-y-6">
          <SidePanel
            connected={connected}
            feedDegraded={feedDegraded}
            lastScanTime={lastScanTime}
            marketsCount={marketsCount}
            liveUpdates={liveUpdates}
            traderState={traderState}
            tradeHistory={tradeHistory}
            signals={signals}
            connectionStatus={connectionStatus}
            availableMarkets={availableMarkets}
            selectedMarket={selectedMarket}
            lastPrice={lastPrice}
            lastDigit={lastDigit}
            windowConfig={windowConfig}
            analytics={analytics}
            slowWindowDigits={slowWindowDigits}
            fastWindowDigits={fastWindowDigits}
            tradeCount={tradeCount}
            calibrationLocked={calibrationLocked}
            calibrationReason={calibrationReason}
            onMarketChange={onMarketChange}
            onFastWindowResize={onFastWindowResize}
            onTokenSubmit={onTokenSubmit}
            onDisconnect={onDisconnect}
            onRecalibrate={onRecalibrate}
          />
        </div>
      </div>
    </div>
  );
}
