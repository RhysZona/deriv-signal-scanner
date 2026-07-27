import type { TradeSetup, TraderState, TradeRecord, MarketSymbol, ConnectionStatus, AnalyticsEngineOutput, WindowConfig } from '../types';
import { ScannerStatus } from './ScannerStatus';
import { LiveMonitor } from './LiveMonitor';
import { TradingControls } from './TradingControls';
import { PnLWidget } from './PnLWidget';
import { TradeHistory } from './TradeHistory';
import { StrategySettings } from './StrategySettings';
import { MarketOverview } from './MarketOverview';
import { DerivAuth } from './DerivAuth';
import { AnalyticsEnginePanel } from './AnalyticsEngine';
import { PatternRead } from './PatternRead';
import { ForwardTelemetry } from './ForwardTelemetry';

interface SidePanelProps {
  connected: boolean;
  feedDegraded: boolean;
  lastScanTime: number | null;
  marketsCount: number | null;
  liveUpdates: TradeSetup[] | null;
  traderState: TraderState | null;
  tradeHistory: TradeRecord[];
  signals: TradeSetup[];
  connectionStatus: ConnectionStatus;
  availableMarkets: MarketSymbol[];
  selectedMarket: string;
  lastPrice: number | null;
  lastDigit: number | null;
  windowConfig: WindowConfig;
  analytics: AnalyticsEngineOutput | null;
  slowWindowDigits: number[];
  fastWindowDigits: number[];
  tradeCount: number;
  calibrationLocked: boolean;
  calibrationReason: string;
  onMarketChange: (symbol: string) => void;
  onFastWindowResize: (size: number) => void;
  onTokenSubmit: (token: string) => void;
  onDisconnect: () => void;
  onRecalibrate: () => void;
}

export function SidePanel({
  connected,
  feedDegraded,
  lastScanTime,
  marketsCount,
  liveUpdates,
  traderState,
  tradeHistory,
  signals,
  connectionStatus,
  availableMarkets,
  selectedMarket,
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
}: SidePanelProps) {
  return (
    <div className="space-y-4">
      {/* Section 3: Deriv API Auth (replaces ScannerStatus as primary status) */}
      <DerivAuth
        connectionStatus={connectionStatus}
        onTokenSubmit={onTokenSubmit}
        onDisconnect={onDisconnect}
      />

      {/* Scanner Status (simplified) */}
      <ScannerStatus
        connected={connected}
        feedDegraded={feedDegraded}
        lastScanTime={lastScanTime}
        marketsCount={marketsCount}
      />

      {/* Section 4: Real-Time Pattern Analytics Engine */}
      <AnalyticsEnginePanel analytics={analytics} />

      {/* Section 5: Comprehensive Pattern Read */}
      <PatternRead
        analytics={analytics}
        totalSignals={signals.length}
      />

      {liveUpdates && liveUpdates.length > 0 && (
        <LiveMonitor liveUpdates={liveUpdates} />
      )}

      {/* Section 6: Bot Control & Execution Suite */}
      <TradingControls state={traderState} />
      <PnLWidget state={traderState} />

      {/* Section 7: Forward Telemetry & Auto-Optimization */}
      <ForwardTelemetry
        tradeCount={tradeCount}
        minSample={200}
        calibrationLocked={calibrationLocked}
        calibrationReason={calibrationReason}
        onRecalibrate={onRecalibrate}
      />

      <TradeHistory trades={tradeHistory} />
      <StrategySettings />
      <MarketOverview signals={signals} />
    </div>
  );
}
