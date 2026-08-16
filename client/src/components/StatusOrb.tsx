interface StatusOrbProps {
  /** ok = live/healthy, warn = degraded, error = offline, idle = unknown. */
  status: 'ok' | 'warn' | 'error' | 'idle';
  /** Show the expanding ping ring. */
  ping?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const COLORS: Record<StatusOrbProps['status'], string> = {
  ok: 'bg-emerald-400 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]',
  warn: 'bg-amber-400 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]',
  error: 'bg-red-500 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
  idle: 'bg-dark-400 text-dark-400',
};

export function StatusOrb({ status, ping = false, size = 'sm', className = '' }: StatusOrbProps) {
  const dim = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <span
      className={`orb ${ping ? 'orb--ping' : ''} ${dim} ${COLORS[status]} ${className}`}
      aria-hidden
    />
  );
}
