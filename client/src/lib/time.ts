/** Format an epoch-ms timestamp as a human-readable relative age ("12s ago"). */
export function formatTimeAgo(timestamp: number, now: number): string {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
