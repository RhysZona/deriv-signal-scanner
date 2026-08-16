import { useSignals } from './hooks/useSignals';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const { connected, feedDegraded, isReconnecting, scanResult, liveUpdates, lastScanTime, totalSignals, marketsCount } = useSignals();

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Scan line animation */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]">
        <div className="scan-line w-full h-px bg-emerald-500" />
      </div>

      <Header
        connected={connected}
        feedDegraded={feedDegraded}
        isReconnecting={isReconnecting}
        lastScanTime={lastScanTime}
        totalSignals={totalSignals}
      />

      <main className="relative z-10">
        <Dashboard
          connected={connected}
          feedDegraded={feedDegraded}
          scanResult={scanResult}
          liveUpdates={liveUpdates}
          lastScanTime={lastScanTime}
          marketsCount={marketsCount}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-700 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-[10px] text-dark-400">
            <span>Deriv Signal Scanner v1.0</span>
            <span>Powered by Deriv API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
