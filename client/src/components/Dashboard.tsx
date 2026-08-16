import type { ScanResult, TradeSetup } from '../types';
import { EmptyState } from './EmptyState';
import { SignalList } from './SignalList';
import { SidePanel } from './SidePanel';
import { HeroStats } from './HeroStats';

interface DashboardProps {
  connected: boolean;
  feedDegraded: boolean;
  isReconnecting: boolean;
  scanResult: ScanResult | null;
  liveUpdates: TradeSetup[] | null;
  lastScanTime: number | null;
  marketsCount: number | null;
}

export function Dashboard({
  connected,
  feedDegraded,
  isReconnecting,
  scanResult,
  liveUpdates,
  lastScanTime,
  marketsCount,
}: DashboardProps) {
  const signals = scanResult?.rankedSignals ?? [];
  const hasSignals = signals.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <HeroStats
        connected={connected}
        feedDegraded={feedDegraded}
        isReconnecting={isReconnecting}
        totalSignals={signals.length}
        marketsCount={marketsCount}
        lastScanTime={lastScanTime}
      />

      {!hasSignals && <EmptyState connected={connected} />}

      {hasSignals && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          <SignalList
            signals={signals}
            liveUpdates={liveUpdates}
            lastScanTime={lastScanTime}
          />

          <SidePanel
            connected={connected}
            feedDegraded={feedDegraded}
            lastScanTime={lastScanTime}
            marketsCount={marketsCount}
            liveUpdates={liveUpdates}
            signals={signals}
          />
        </div>
      )}
    </div>
  );
}
