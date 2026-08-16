import type { ReactNode } from 'react';
import { GlassCard } from './GlassCard';
import { StatusOrb } from './StatusOrb';
import { useStrategyConfig } from '../hooks/useStrategyConfig';
import { useCountUp } from '../hooks/useCountUp';
import { useNow } from '../hooks/useNow';

interface HeroStatsProps {
  connected: boolean;
  feedDegraded: boolean;
  isReconnecting: boolean;
  totalSignals: number;
  marketsCount: number | null;
  lastScanTime: number | null;
}

function Tile({
  icon,
  label,
  children,
  className = '',
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={`px-4 py-3.5 ${className}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-dark-300">
        <span className="opacity-70">{icon}</span>
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </GlassCard>
  );
}

export function HeroStats({ connected, feedDegraded, isReconnecting, totalSignals, marketsCount, lastScanTime }: HeroStatsProps) {
  const { config } = useStrategyConfig();
  const now = useNow(1000);

  const signalCount = Math.round(useCountUp(totalSignals));
  const marketCount = Math.round(useCountUp(marketsCount ?? 0));
  const threshold = config?.quietThreshold ?? 9.7;
  const thresholdDisplay = useCountUp(threshold);

  const scanIntervalMs = config?.scanIntervalMs ?? 30_000;
  const nextScanAt = lastScanTime !== null ? lastScanTime + scanIntervalMs : null;
  const remainingMs = nextScanAt !== null ? Math.max(0, nextScanAt - now) : 0;
  const progress = nextScanAt !== null ? 1 - remainingMs / scanIntervalMs : 0;
  const remainingSec = nextScanAt !== null ? Math.ceil(remainingMs / 1000) : null;

  const feedOrb: 'ok' | 'warn' | 'error' = !connected ? 'error' : feedDegraded ? 'warn' : 'ok';
  const feedLabel = !connected ? (isReconnecting ? 'Reconnecting' : 'Offline') : feedDegraded ? 'Feed Issue' : 'Live';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
      {/* Signals */}
      <Tile
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        }
        label="Signals"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
            {signalCount}
          </span>
          <span className="text-[10px] text-dark-400">ranked now</span>
        </div>
      </Tile>

      {/* Markets */}
      <Tile
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0l3.5-9.5L12 3m0 18l-3.5-9.5L12 3" opacity={0.8} />
          </svg>
        }
        label="Markets"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold font-mono tabular-nums text-sky-300">{marketCount}</span>
          <span className="text-[10px] text-dark-400">tracked live</span>
        </div>
      </Tile>

      {/* Quiet threshold (live config) */}
      <Tile
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        label="Quiet line"
        className="col-span-1"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold font-mono tabular-nums text-violet-300">≤{thresholdDisplay.toFixed(1)}%</span>
        </div>
      </Tile>

      {/* Feed status */}
      <Tile
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
          </svg>
        }
        label="Deriv feed"
      >
        <div className="flex items-center gap-2">
          <StatusOrb status={feedOrb} ping={feedOrb !== 'error'} size="md" />
          <span className={`text-sm font-bold ${feedOrb === 'ok' ? 'text-emerald-300' : feedOrb === 'warn' ? 'text-amber-300' : 'text-red-400'}`}>
            {feedLabel}
          </span>
        </div>
      </Tile>

      {/* Next scan countdown */}
      <Tile
        icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        }
        label="Next scan"
        className="col-span-2 sm:col-span-1"
      >
        <div className="flex items-center gap-3">
          <CountdownRing progress={progress} />
          <span className="text-xl font-extrabold font-mono tabular-nums text-dark-100">
            {remainingSec !== null ? `${remainingSec}s` : '—'}
          </span>
        </div>
      </Tile>
    </div>
  );
}

const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CountdownRing({ progress }: { progress: number }) {
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = CIRCUMFERENCE * (1 - clamped);
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="countdown-ring -rotate-90 shrink-0">
      <circle cx="22" cy="22" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r={RADIUS}
        fill="none"
        stroke="url(#ringGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.6))' }}
      />
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}
