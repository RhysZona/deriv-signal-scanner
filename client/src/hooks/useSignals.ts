import { useEffect, useRef, useState, useCallback } from 'react';
import type { ScanResult, TradeSetup, TraderState, TradeRecord, MarketSymbol } from '../types';

interface SignalsState {
  connected: boolean;
  feedDegraded: boolean;
  scanResult: ScanResult | null;
  liveUpdates: TradeSetup[] | null;
  lastScanTime: number | null;
  totalSignals: number;
  error: string | null;
  traderState: TraderState | null;
  tradeHistory: TradeRecord[];
  isReconnecting: boolean;
  traderTradeCount: number;
  availableMarkets: MarketSymbol[];
}

export function useSignals() {
  const [state, setState] = useState<SignalsState>({
    connected: false,
    feedDegraded: false,
    scanResult: null,
    liveUpdates: null,
    lastScanTime: null,
    totalSignals: 0,
    error: null,
    traderState: null,
    tradeHistory: [],
    isReconnecting: false,
    traderTradeCount: 0,
    availableMarkets: [],
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
          }));
        }
      } catch (e) {
        console.error('[SSE] Status parse error:', e);
      }
    });

    // ── Trade state (initial snapshot + live updates) ──────────────────────
    es.addEventListener('trade_state', (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({
          ...prev,
          traderState: data,
          traderTradeCount: (data.wins ?? 0) + (data.losses ?? 0),
        }));
      } catch (e) {
        console.error('[SSE] Trade state parse error:', e);
      }
    });

    // ── Individual trade events (placed / won / lost / dry_run) ────────────
    es.addEventListener('trade', (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.record) {
          setState(prev => {
            const newState = {
              ...prev,
              traderState: data.state ?? prev.traderState,
              tradeHistory: [data.record, ...prev.tradeHistory].slice(0, 50),
            };
            // Update trade count from the latest state
            if (data.state) {
              newState.traderTradeCount = (data.state.wins ?? 0) + (data.state.losses ?? 0);
            }
            return newState;
          });
        }
      } catch (e) {
        console.error('[SSE] Trade parse error:', e);
      }
    });

    es.addEventListener('markets', (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data.markets)) {
          setState(prev => ({ ...prev, availableMarkets: data.markets }));
        }
      } catch (e) {
        console.error('[SSE] Markets parse error:', e);
      }
    });

    es.addEventListener('error', () => {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, connected: false, feedDegraded: false, isReconnecting: true }));
      es.close();

      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) {
          setState(prev => ({ ...prev, isReconnecting: false }));
          connect();
        }
      }, 3000);
    });
  }, []);

  // Fetch market list on mount
  useEffect(() => {
    fetch('/api/markets')
      .then((res) => res.json())
      .then((data) => {
        if (data.markets) {
          setState(prev => ({ ...prev, availableMarkets: data.markets }));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch trading status periodically
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/trading/status');
        const data = await res.json();
        if (data.state) {
          setState(prev => ({
            ...prev,
            traderState: data.state,
            traderTradeCount: (data.state.wins ?? 0) + (data.state.losses ?? 0),
          }));
        }
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // SSE connection lifecycle
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
