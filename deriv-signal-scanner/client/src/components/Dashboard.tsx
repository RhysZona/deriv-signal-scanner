import type { ScanResult, TradeSetup, TraderState, TradeRecord } from '../types';
import { EmptyState } from './EmptyState';
import { SignalList } from './SignalList';
import { SidePanel } from './SidePanel';

interface DashboardProps {
  connected: boolean;
  feedDegraded: boolean;
  scanResult: ScanResult | null;
  liveUpdates: TradeSetup[] | null;
  lastScanTime: number | null;
  marketsCount: number | null;
  traderState: TraderState | null;
  tradeHistory: TradeRecord[];
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
}: DashboardProps) {
  const signals = scanResult?.rankedSignals ?? [];
  const hasSignals = signals.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {!hasSignals && <EmptyState connected={connected} />}

      {hasSignals && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            traderState={traderState}
            tradeHistory={tradeHistory}
            signals={signals}
          />
        </div>
      )}
    </div>
  );
}
