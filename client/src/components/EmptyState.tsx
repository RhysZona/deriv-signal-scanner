import { StatusOrb } from './StatusOrb';

interface EmptyStateProps {
  connected: boolean;
}

export function EmptyState({ connected }: EmptyStateProps) {
  return (
    <div className="text-center py-16 sm:py-24">
      {/* Radar */}
      <div className="relative w-28 h-28 mx-auto mb-8" aria-hidden>
        <div className="absolute inset-0 rounded-full border border-emerald-400/20" />
        <div className="absolute inset-4 rounded-full border border-emerald-400/15" />
        <div className="absolute inset-8 rounded-full border border-emerald-400/10" />
        <div className="absolute inset-0 rounded-full border border-emerald-400/30 opacity-60 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="radar-sweep absolute inset-0" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.12),transparent_70%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
      </div>

      <h2 className="text-xl font-extrabold text-dark-100 tracking-tight mb-2">Scanning the markets</h2>
      <p className="text-sm text-dark-300 max-w-md mx-auto mb-6 leading-relaxed">
        {connected
          ? 'No signals right now. The scanner re-analyzes every market every 30 seconds — quiet digits can appear at any tick.'
          : 'Connecting to the Deriv API to scan markets...'}
      </p>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--chip-bg)] border border-[var(--chip-border)] text-xs text-dark-300">
        <StatusOrb status={connected ? 'ok' : 'warn'} ping />
        <span>{connected ? 'Scanning markets' : 'Establishing connection'}</span>
      </div>
    </div>
  );
}
