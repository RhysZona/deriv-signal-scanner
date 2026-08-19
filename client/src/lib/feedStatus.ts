/**
 * Derive a single, honest feed state from the connection status.
 *
 * Priority matters: when Deriv refuses the live `ticks` stream, the scanner
 * keeps data flowing via the `ticks_history` polling fallback, and the
 * connection also flags `feedDegraded` — so `liveStreamBlocked` must win over
 * `feedDegraded`. Only when the stream is usable but no ticks arrive is the
 * feed genuinely stalled.
 */
export type FeedState = 'live' | 'polling' | 'stalled' | 'offline';

export function getFeedState(opts: {
  connected: boolean;
  liveStreamBlocked: boolean;
  feedDegraded: boolean;
}): FeedState {
  if (!opts.connected) return 'offline';
  if (opts.liveStreamBlocked) return 'polling';
  if (opts.feedDegraded) return 'stalled';
  return 'live';
}

/** Orb tone per feed state. */
export function feedOrb(state: FeedState): 'ok' | 'warn' | 'error' {
  switch (state) {
    case 'live':
      return 'ok';
    case 'polling':
      return 'warn';
    case 'stalled':
    case 'offline':
      return 'error';
  }
}
