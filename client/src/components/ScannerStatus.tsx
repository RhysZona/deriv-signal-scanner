import { GlassCard } from './GlassCard';
import { StatusOrb } from './StatusOrb';
import { useStrategyConfig } from '../hooks/useStrategyConfig';
import { useNow } from '../hooks/useNow';

interface ScannerStatusProps {
  connected: boolean;
  feedDegraded: boolean;
  lastScanTime: number | null;
  marketsCount: number | null;
}

const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScannerStatus({ connected, feedDegraded, lastScanTime, marketsCount }: ScannerStatusProps) {
  const { config } = useStrategyConfig();
  const now = useNow(1000);

  const orb: 'ok' | 'warn' | 'error' = !connected ? 'error' : feedDegraded ? 'warn' : 'ok';
  const statusLabel = connected ? (feedDegraded ? 'Degraded' : 'Active') : 'Offline';

  const scanIntervalMs = config?.scanIntervalMs ?? 30_000;
  const nextScanAt = lastScanTime !== null ? lastScanTime + scanIntervalMs : null;
  const remainingMs = nextScanAt !== null ? Math.max(0, nextScanAt - now) : 0;
  const progress = nextScanAt !== null ? 1 - remainingMs / scanIntervalMs : 0;
  const offset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <GlassCard className="px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-dark-200 uppercase tracking-[0.14em]">Scanner Status</h3>
        <span
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            orb === 'ok'
              ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25'
              : orb === 'warn'
                ? 'bg-amber-400/10 text-amber-300 border-amber-400/25'
                : 'bg-red-500/10 text-red-400 border-red-500/25'
          }`}
        >
          <StatusOrb status={orb} ping={orb !== 'error'} size="sm" />
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-5">
        {/* Next-scan countdown ring */}
        <div className="relative shrink-0">
          <svg width="52" height="52" viewBox="0 0 52 52" className="countdown-ring -rotate-90">
            <circle cx="26" cy="26" r={RADIUS} fill="none" strokeWidth="3.5" style={{ stroke: 'var(--ring-track)' }} />
            <circle
              cx="26"
              cy="26"
              r={RADIUS}
              fill="none"
              stroke="url(#scanRingGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{ filter: 'drop-shadow(0 0 5px rgba(52,211,153,0.55))' }}
            />
            <defs>
              <linearGradient id="scanRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold text-dark-100 tabular-nums">
            {nextScanAt !== null ? `${Math.ceil(remainingMs / 1000)}s` : '—'}
          </span>
        </div>

        <div className="flex-1 space-y-2.5">
          <Row label="Connection" value={connected ? (feedDegraded ? 'Feed Stalled' : 'Connected') : 'Disconnected'} mono={false} />
          <Row label="Last Scan" value={lastScanTime ? formatTime(lastScanTime) : '—'} mono />
          <Row label="Markets Tracked" value={marketsCount !== null ? String(marketsCount) : '—'} mono />
          <Row label="Scan Interval" value={`${Math.round(scanIntervalMs / 1000)}s`} mono />
        </div>
      </div>

      {feedDegraded && (
        <div className="mt-4 px-3 py-2.5 rounded-xl bg-amber-400/[0.07] border border-amber-400/25 flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-[11px] font-bold text-amber-300">Feed Degraded</p>
            <p className="text-[10px] text-amber-400/70 mt-0.5">
              No ticks received on active subscriptions. The scanner may be stalled.
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-dark-300">{label}</span>
      <span className={`text-xs font-semibold text-dark-100 ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </span>
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
