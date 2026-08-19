import type { TradeSetup } from '../types';
import { ScannerStatus } from './ScannerStatus';
import { LiveMonitor } from './LiveMonitor';
import { MarketOverview } from './MarketOverview';

interface SidePanelProps {
  connected: boolean;
  feedDegraded: boolean;
  liveStreamBlocked: boolean;
  lastScanTime: number | null;
  marketsCount: number | null;
  rateLimitedUntil: number;
  liveUpdates: TradeSetup[] | null;
  signals: TradeSetup[];
}

export function SidePanel({
  connected,
  feedDegraded,
  liveStreamBlocked,
  lastScanTime,
  marketsCount,
  rateLimitedUntil,
  liveUpdates,
  signals,
}: SidePanelProps) {
  return (
    <div className="lg:col-span-2 xl:col-span-1 space-y-5">
      <ScannerStatus
        connected={connected}
        feedDegraded={feedDegraded}
        liveStreamBlocked={liveStreamBlocked}
        lastScanTime={lastScanTime}
        marketsCount={marketsCount}
        rateLimitedUntil={rateLimitedUntil}
      />

      {liveUpdates && liveUpdates.length > 0 && (
        <LiveMonitor liveUpdates={liveUpdates} />
      )}

      <MarketOverview signals={signals} />
    </div>
  );
}
