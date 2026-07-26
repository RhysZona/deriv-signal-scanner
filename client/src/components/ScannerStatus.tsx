interface ScannerStatusProps {
  connected: boolean;
  feedDegraded: boolean;
  lastScanTime: number | null;
  marketsCount: number | null;
}

export function ScannerStatus({ connected, feedDegraded, lastScanTime, marketsCount }: ScannerStatusProps) {
  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">Scanner Status</h3>
        <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
          connected
            ? feedDegraded
              ? 'bg-amber-900/30 text-amber-400'
              : 'bg-emerald-900/30 text-emerald-400'
            : 'bg-red-900/30 text-red-400'
        }`}>
          {connected ? (feedDegraded ? 'Degraded' : 'Active') : 'Offline'}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-300">Connection</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              connected
                ? feedDegraded
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-emerald-500'
                : 'bg-red-500'
            }`} />
            <span className="text-xs font-medium text-dark-200">
              {connected ? (feedDegraded ? 'Feed Stalled' : 'Connected') : 'Disconnected'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-300">Last Scan</span>
          <span className="text-xs font-mono font-medium text-dark-200">
            {lastScanTime ? formatTime(lastScanTime) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-300">Markets Tracked</span>
          <span className="text-xs font-mono font-medium text-dark-200">
            {marketsCount ?? '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-300">Scan Interval</span>
          <span className="text-xs font-mono font-medium text-dark-200">30s</span>
        </div>
        {feedDegraded && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-600/30 flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-[11px] font-semibold text-amber-300">Feed Degraded</p>
              <p className="text-[10px] text-amber-400/70 mt-0.5">
                No ticks received on active subscriptions. The scanner may be stalled.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
