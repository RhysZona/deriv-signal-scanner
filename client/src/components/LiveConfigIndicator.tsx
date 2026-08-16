import { useStrategyConfig } from '../hooks/useStrategyConfig';
import { useNow } from '../hooks/useNow';
import { formatTimeAgo } from '../lib/time';
import { StatusOrb } from './StatusOrb';

/**
 * Small live-config chip for the header: shows the scanner's quiet threshold
 * (from the polled /api/config) and how long ago it last synced. The dot turns
 * amber while the config has never loaded or the feed of config updates has
 * gone stale (past ~2.5 poll intervals).
 */
export function LiveConfigIndicator() {
  const { config, syncedAt, pollIntervalMs } = useStrategyConfig();
  const now = useNow(1000);

  const stale = syncedAt !== null && now - syncedAt > pollIntervalMs * 2.5;
  const orb = syncedAt === null || stale ? 'warn' : 'ok';
  const cadenceLabel = `every ${(pollIntervalMs / 1000).toFixed(0)}s`;

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--chip-bg)] border border-[var(--chip-border)] backdrop-blur"
      title={`Live strategy config — polls /api/config ${cadenceLabel}`}
    >
      <StatusOrb status={orb} ping={orb === 'ok'} size="sm" />
      <span className="text-[10px] font-mono font-semibold text-dark-100">
        ≤{config?.quietThreshold ?? '—'}%
      </span>
      <span className="text-[10px] text-dark-400">
        · {syncedAt !== null ? formatTimeAgo(syncedAt, now) : 'config…'}
      </span>
    </div>
  );
}
