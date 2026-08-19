import { useSignals } from './hooks/useSignals';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const { connected, feedDegraded, liveStreamBlocked, isReconnecting, scanResult, liveUpdates, lastScanTime, totalSignals, marketsCount, rateLimitedUntil } = useSignals();

  return (
    <div className="relative min-h-screen text-dark-100 antialiased">
      {/* Ambient aurora + grid */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
        <div className="aurora-blob -top-44 -left-44 w-[44rem] h-[44rem] bg-[var(--aurora-1)]" />
        <div className="aurora-blob aurora-blob--2 top-1/4 -right-52 w-[40rem] h-[40rem] bg-[var(--aurora-2)]" />
        <div className="aurora-blob aurora-blob--3 -bottom-56 left-1/3 w-[46rem] h-[46rem] bg-[var(--aurora-3)]" />
        <div className="absolute inset-0 bg-grid" />
      </div>

      <Header
        connected={connected}
        feedDegraded={feedDegraded}
        liveStreamBlocked={liveStreamBlocked}
        isReconnecting={isReconnecting}
        lastScanTime={lastScanTime}
        totalSignals={totalSignals}
        rateLimitedUntil={rateLimitedUntil}
      />

      <main className="relative z-10">
        <Dashboard
          connected={connected}
          feedDegraded={feedDegraded}
          liveStreamBlocked={liveStreamBlocked}
          isReconnecting={isReconnecting}
          scanResult={scanResult}
          liveUpdates={liveUpdates}
          lastScanTime={lastScanTime}
          marketsCount={marketsCount}
          rateLimitedUntil={rateLimitedUntil}
        />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--divider)] mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-[10px] text-dark-400">
            <span className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-emerald-400/70" />
              Deriv Signal Scanner v1.0
            </span>
            <span>Powered by Deriv API</span>
          </div>
        </div>
      </footer>

      {/* Film grain */}
      <div className="fixed inset-0 z-[70] pointer-events-none noise-overlay opacity-[0.045]" aria-hidden />
    </div>
  );
}
