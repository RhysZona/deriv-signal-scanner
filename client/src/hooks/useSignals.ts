import { useEffect, useRef, useState, useCallback } from 'react';
import type { ScanResult, TradeSetup } from '../types';

interface SignalsState {
  connected: boolean;
  feedDegraded: boolean;
  /** True when Deriv refuses the real-time ticks stream (polling fallback active). */
  liveStreamBlocked: boolean;
  scanResult: ScanResult | null;
  liveUpdates: TradeSetup[] | null;
  lastScanTime: number | null;
  totalSignals: number;
  error: string | null;
  /** True while the error handler's reconnect timer is counting down. */
  isReconnecting: boolean;
  /** Epoch ms when the scanner's rate-limit backoff expires (0 = not rate-limited). */
  rateLimitedUntil: number;
}

export function useSignals() {
  const [state, setState] = useState<SignalsState>({
    connected: false,
    feedDegraded: false,
    liveStreamBlocked: false,
    scanResult: null,
    liveUpdates: null,
    lastScanTime: null,
    totalSignals: 0,
    error: null,
    isReconnecting: false,
    rateLimitedUntil: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/signals/stream');
    eventSourceRef.current = es;

    es.addEventListener('open', () => {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, connected: true, error: null, isReconnecting: false }));
    });

    es.addEventListener('scan_result', (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.scanResult) {
          setState(prev => ({
            ...prev,
            scanResult: data.scanResult,
            liveUpdates: data.liveUpdates ?? null,
            lastScanTime: data.scanResult.timestamp,
            totalSignals: data.scanResult.rankedSignals.length,
          }));
        }
      } catch (e) {
        console.error('[SSE] Parse error:', e);
      }
    });

    es.addEventListener('live_update', (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.scanResult) {
          setState(prev => ({
            ...prev,
            scanResult: data.scanResult,
            liveUpdates: data.liveUpdates ?? null,
            lastScanTime: data.scanResult.timestamp ?? prev.lastScanTime,
          }));
        }
      } catch (e) {
        console.error('[SSE] Live parse error:', e);
      }
    });

    es.addEventListener('status', (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (typeof data.connected === 'boolean') {
          setState(prev => ({
            ...prev,
            connected: data.connected,
            feedDegraded: data.feedDegraded ?? false,
            liveStreamBlocked: data.liveStreamBlocked ?? false,
          }));
        }
      } catch (e) {
        console.error('[SSE] Status parse error:', e);
      }
    });

    es.addEventListener('scanner_status', (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (typeof data.rateLimitedUntil === 'number') {
          setState(prev => ({ ...prev, rateLimitedUntil: data.rateLimitedUntil }));
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('error', () => {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, connected: false, feedDegraded: false, liveStreamBlocked: false, isReconnecting: true, rateLimitedUntil: 0 }));
      es.close();

      // Reconnect after a delay
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) {
          setState(prev => ({ ...prev, isReconnecting: false }));
          connect();
        }
      }, 3000);
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const marketsCount = state.scanResult?.markets
    ? new Set(state.scanResult.markets.map(m => m.marketSymbol)).size
    : null;

  return { ...state, marketsCount };
}
