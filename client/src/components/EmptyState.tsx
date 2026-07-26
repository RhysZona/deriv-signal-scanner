interface EmptyStateProps {
  connected: boolean;
}

export function EmptyState({ connected }: EmptyStateProps) {
  return (
    <div className="text-center py-24">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-dark-700 mb-6">
        <svg className="w-10 h-10 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-dark-200 mb-2">No signals found</h2>
      <p className="text-sm text-dark-400 max-w-md mx-auto mb-6">
        {connected
          ? 'Waiting for the scanner to analyze markets. A scan runs every 30 seconds.'
          : 'Connecting to the Deriv API to scan markets...'}
      </p>
      <div className="flex items-center justify-center gap-2 text-xs text-dark-400">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
        <span>{connected ? 'Scanning markets' : 'Establishing connection'}</span>
      </div>
    </div>
  );
}
