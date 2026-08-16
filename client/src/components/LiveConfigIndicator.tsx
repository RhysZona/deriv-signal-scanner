import { useEffect, useState } from 'react';
import { useStrategyConfig } from '../hooks/useStrategyConfig';
import { formatTimeAgo } from '../lib/time';

/**
 * Small live-config chip for the header: shows the scanner's quiet threshold
 * (from the polled /api/config) and how long ago it last synced. The dot turns
 * amber while the config has never loaded or the feed of config updates has
 * gone stale (past ~2.5 poll intervals).
 */
export function LiveConfigIndicator() {
  const { config, syncedAt, pollIntervalMs } = useStrategyConfig();
  // Re-render each second so the "Xs ago" countdown stays up-to-date.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const stale = syncedAt !== null && now - syncedAt > pollIntervalMs * 2.5;
  const dotClass = syncedAt === null || stale
    ? 'bg-amber-500 animate-pulse'
    : 'bg-emerald-500 shadow-sm shadow-emerald-500/50';
  const cadenceLabel = `every ${(pollIntervalMs / 1000).toFixed(0)}s`;

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-700/60 border border-dark-600"
      title={`Live strategy config — polls /api/config ${cadenceLabel}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span className="text-[10px] font-mono font-semibold text-dark-200">
        ≤{config?.quietThreshold ?? '—'}%
      </span>
      <span className="text-[10px] text-dark-400">
        · {syncedAt !== null ? formatTimeAgo(syncedAt, now) : 'config…'}
      </span>
    </div>
  );
}
