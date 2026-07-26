import type { TradeSetup, TraderState, TradeRecord } from '../types';
import { ScannerStatus } from './ScannerStatus';
import { LiveMonitor } from './LiveMonitor';
import { TradingControls } from './TradingControls';
import { PnLWidget } from './PnLWidget';
import { TradeHistory } from './TradeHistory';
import { StrategySettings } from './StrategySettings';
import { MarketOverview } from './MarketOverview';

interface SidePanelProps {
  connected: boolean;
  feedDegraded: boolean;
  lastScanTime: number | null;
  marketsCount: number | null;
  liveUpdates: TradeSetup[] | null;
  traderState: TraderState | null;
  tradeHistory: TradeRecord[];
  signals: TradeSetup[];
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
}: SidePanelProps) {
  return (
    <div className="xl:col-span-1 space-y-6">
      <ScannerStatus
        connected={connected}
        feedDegraded={feedDegraded}
        lastScanTime={lastScanTime}
        marketsCount={marketsCount}
      />

      {liveUpdates && liveUpdates.length > 0 && (
        <LiveMonitor liveUpdates={liveUpdates} />
      )}

      <TradingControls state={traderState} />
      <PnLWidget state={traderState} />
      <TradeHistory trades={tradeHistory} />
      <StrategySettings />
      <MarketOverview signals={signals} />
    </div>
  );
}
