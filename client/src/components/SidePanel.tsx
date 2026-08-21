import type { TradeSetup } from '../types';
import { ScannerStatus } from './ScannerStatus';
import { LiveMonitor } from './LiveMonitor';
import { MarketOverview } from './MarketOverview';
import { DonationCard } from './DonationCard';
import type { StrategyMode } from './SignalList';

interface SidePanelProps {
  connected: boolean;
  feedDegraded: boolean;
  liveStreamBlocked: boolean;
  lastScanTime: number | null;
  marketsCount: number | null;
  rateLimitedUntil: number;
  liveUpdates: TradeSetup[] | null;
  signals: TradeSetup[];
  strategyMode: StrategyMode;
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
  strategyMode,
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
        <LiveMonitor liveUpdates={liveUpdates} strategyMode={strategyMode} />
      )}

      <MarketOverview signals={signals} />

      <DonationCard liveUpdates={liveUpdates} />
    </div>
  );
}
