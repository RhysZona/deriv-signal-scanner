import { useState } from 'react';
import type { ScanResult, TradeSetup } from '../types';
import { EmptyState } from './EmptyState';
import { SignalList, StrategyMode } from './SignalList';
import { SidePanel } from './SidePanel';
import { HeroStats } from './HeroStats';

interface DashboardProps {
  connected: boolean;
  feedDegraded: boolean;
  liveStreamBlocked: boolean;
  isReconnecting: boolean;
  scanResult: ScanResult | null;
  liveUpdates: TradeSetup[] | null;
  lastScanTime: number | null;
  marketsCount: number | null;
  rateLimitedUntil: number;
}

export function Dashboard({
  connected,
  feedDegraded,
  liveStreamBlocked,
  isReconnecting,
  scanResult,
  liveUpdates,
  lastScanTime,
  marketsCount,
  rateLimitedUntil,
}: DashboardProps) {
  const signals = scanResult?.rankedSignals ?? [];
  const hasSignals = signals.length > 0;
  const [strategyMode, setStrategyMode] = useState<StrategyMode>('over-under');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <HeroStats
        connected={connected}
        feedDegraded={feedDegraded}
        liveStreamBlocked={liveStreamBlocked}
        isReconnecting={isReconnecting}
        totalSignals={signals.length}
        marketsCount={marketsCount}
        lastScanTime={lastScanTime}
        rateLimitedUntil={rateLimitedUntil}
      />

      {!hasSignals && <EmptyState connected={connected} />}

      {hasSignals && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          <SignalList
            signals={signals}
            liveUpdates={liveUpdates}
            lastScanTime={lastScanTime}
            strategyMode={strategyMode}
            onStrategyModeChange={setStrategyMode}
          />

          <SidePanel
            connected={connected}
            feedDegraded={feedDegraded}
            liveStreamBlocked={liveStreamBlocked}
            lastScanTime={lastScanTime}
            marketsCount={marketsCount}
            rateLimitedUntil={rateLimitedUntil}
            liveUpdates={liveUpdates}
            signals={signals}
            strategyMode={strategyMode}
          />
        </div>
      )}
    </div>
  );
}
