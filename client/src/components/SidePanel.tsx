import type { TradeSetup } from '../types';
import { ScannerStatus } from './ScannerStatus';
import { LiveMonitor } from './LiveMonitor';
import { MarketOverview } from './MarketOverview';

interface SidePanelProps {
  connected: boolean;
  feedDegraded: boolean;
  lastScanTime: number | null;
  marketsCount: number | null;
  liveUpdates: TradeSetup[] | null;
  signals: TradeSetup[];
}

export function SidePanel({
  connected,
  feedDegraded,
  lastScanTime,
  marketsCount,
  liveUpdates,
  signals,
}: SidePanelProps) {
  return (
    <div className="lg:col-span-2 xl:col-span-1 space-y-5">
      <ScannerStatus
        connected={connected}
        feedDegraded={feedDegraded}
        lastScanTime={lastScanTime}
        marketsCount={marketsCount}
      />

      {liveUpdates && liveUpdates.length > 0 && (
        <LiveMonitor liveUpdates={liveUpdates} />
      )}

      <MarketOverview signals={signals} />
    </div>
  );
}
