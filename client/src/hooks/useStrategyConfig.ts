import { useEffect, useState } from 'react';
import type { StrategyConfig } from '../types';

/** Initial cadence used until /api/config reports its configPollMs (ms). */
const DEFAULT_POLL_INTERVAL_MS = 15_000;
/** Sanity bounds so a bad configPollMs can't hammer the API or go stale for minutes. */
const MIN_POLL_INTERVAL_MS = 2_000;
const MAX_POLL_INTERVAL_MS = 600_000;
/** Fetch-abort floor, kept below MIN_POLL_INTERVAL_MS so recovery is always within one interval. */
const MIN_FETCH_TIMEOUT_MS = 1_500;

/**
 * Fallback quiet threshold used by the digit chart when /api/config is
 * unreachable or hasn't loaded yet. Mirrors the server's own default so the
 * threshold marker degrades gracefully instead of disappearing.
 */
export const DEFAULT_QUIET_THRESHOLD = 9.8;

export interface StrategyConfigState {
  /** Latest successfully fetched strategy config, or null before the first fetch. */
  config: StrategyConfig | null;
  /** Epoch ms of the last successful fetch (null until the first success). */
  syncedAt: number | null;
  /** Current poll cadence in ms (clamped version of the server's configPollMs). */
  pollIntervalMs: number;
}

let cachedConfig: StrategyConfig | null = null;
let syncedAt: number | null = null;
let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
let inflight: Promise<StrategyConfig | null> | null = null;
let outageLogged = false;
const subscribers = new Set<(state: StrategyConfigState) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function notifySubscribers() {
  const state: StrategyConfigState = { config: cachedConfig, syncedAt, pollIntervalMs };
  for (const listener of subscribers) listener(state);
}

function clampPollInterval(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_POLL_INTERVAL_MS;
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, Math.round(value)));
}

function configsEqual(a: StrategyConfig | null, b: StrategyConfig | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.quietThreshold === b.quietThreshold &&
    a.lookbackTicks === b.lookbackTicks &&
    a.scanIntervalMs === b.scanIntervalMs &&
    a.marketRefreshMs === b.marketRefreshMs &&
    a.configPollMs === b.configPollMs &&
    a.excludeDigits.length === b.excludeDigits.length &&
    a.excludeDigits.every((d, i) => d === b.excludeDigits[i])
  );
}

/**
 * Fetch the config once, sharing a single in-flight request across all consumers.
 * Subscribers are re-notified on every successful fetch (syncedAt refreshes),
 * while cachedConfig is only replaced when the value actually changes.
 */
function fetchConfig(): void {
  if (inflight) return;
  // Abort slow requests so a hung fetch can't stall polling; derived from the
  // current cadence (capped, with a floor below the min interval) so recovery
  // stays within roughly one interval even at the fastest cadence.
  const fetchTimeoutMs = Math.min(10_000, Math.max(MIN_FETCH_TIMEOUT_MS, pollIntervalMs - 1_000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
  inflight = fetch('/api/config', { signal: controller.signal })
    .then((res) => {
      if (!res.ok) throw new Error(`config request failed: ${res.status}`);
      return res.json() as Promise<StrategyConfig>;
    })
    .then((data) => {
      // Every successful fetch counts as a sync, even when the value is
      // unchanged, so the UI's "last sync" time stays fresh during healthy
      // steady-state polling.
      syncedAt = Date.now();
      outageLogged = false;
      // Adopt the server's poll cadence and reschedule the shared timer if it
      // changed (clamped to safe bounds).
      const nextInterval = clampPollInterval(data.configPollMs);
      if (nextInterval !== pollIntervalMs) {
        pollIntervalMs = nextInterval;
        restartPollTimer();
      }
      if (!configsEqual(cachedConfig, data)) {
        cachedConfig = data;
      }
      notifySubscribers();
      return data;
    })
    .catch((err) => {
      // A timed-out request is a slow response, not an outage — don't spam logs.
      const timedOut = err instanceof DOMException && err.name === 'AbortError';
      if (!timedOut && !outageLogged) {
        console.error('[useStrategyConfig] Failed to load strategy config:', err);
        outageLogged = true;
      }
      return null;
    })
    .finally(() => {
      clearTimeout(timeout);
      inflight = null;
    });
}

/** Start the single shared poller on first subscriber (with an immediate fetch). */
function ensurePolling(): void {
  if (pollTimer) return;
  fetchConfig();
  pollTimer = setInterval(fetchConfig, pollIntervalMs);
}

/** Recreate the timer with the current cadence (e.g. after configPollMs changes). */
function restartPollTimer(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = setInterval(fetchConfig, pollIntervalMs);
  }
}

/** Stop the poller once the last subscriber unmounts. */
function stopPollingIfIdle(): void {
  if (subscribers.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Fetch the live strategy config from the server and keep it fresh by polling
 * /api/config at the cadence the server reports (configPollMs, default 15s).
 * All consumers share one module-level cache and a single poller, so the many
 * signal cards only trigger one request per tick. Returns { config, syncedAt,
 * pollIntervalMs }: config and syncedAt are null until the first successful
 * fetch; pollIntervalMs is the active (clamped) cadence.
 */
export function useStrategyConfig(): StrategyConfigState {
  const [state, setState] = useState<StrategyConfigState>({ config: cachedConfig, syncedAt, pollIntervalMs });

  useEffect(() => {
    subscribers.add(setState);
    ensurePolling();
    return () => {
      subscribers.delete(setState);
      stopPollingIfIdle();
    };
  }, []);

  return state;
}
