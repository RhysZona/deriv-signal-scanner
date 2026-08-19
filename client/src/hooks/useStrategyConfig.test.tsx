import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StrategyConfig } from '../types';
import type { StrategyConfigState } from './useStrategyConfig';

type UseStrategyConfig = () => StrategyConfigState;

const BASE_CONFIG: StrategyConfig = {
  quietThreshold: 9.8,
  excludeDigits: [0, 9],
  lookbackTicks: 1000,
  scanIntervalMs: 30_000,
  marketRefreshMs: 3_600_000,
  configPollMs: 15_000,
};

const START_TIME = 1_000_000_000_000;

let useStrategyConfig: UseStrategyConfig;

beforeEach(async () => {
  // Fresh module instance per test so the module-level poller/cache state
  // (cachedConfig, timers, subscribers) never leaks between tests.
  vi.resetModules();
  const mod = await import('./useStrategyConfig');
  useStrategyConfig = mod.useStrategyConfig;

  vi.useFakeTimers();
  vi.setSystemTime(START_TIME);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function jsonResponse(config: StrategyConfig) {
  return { ok: true, json: async () => config } as unknown as Response;
}

function mountHook() {
  return renderHook(() => useStrategyConfig());
}

/** Drain pending microtasks so a resolved fetch's promise chain runs inside act. */
async function flush() {
  await act(async () => {});
}

describe('useStrategyConfig', () => {
  it('fetches immediately on mount, adopts configPollMs, and keeps polling', async () => {
    const config = { ...BASE_CONFIG, configPollMs: 5_000 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(config));
    vi.stubGlobal('fetch', fetchMock);

    const { result, unmount } = mountHook();

    // Defaults before the first response lands.
    expect(result.current.config).toBeNull();
    expect(result.current.syncedAt).toBeNull();
    expect(result.current.pollIntervalMs).toBe(15_000);

    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/config',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.config).toEqual(config);
    expect(result.current.syncedAt).toBe(START_TIME);
    expect(result.current.pollIntervalMs).toBe(5_000); // adopted from the server

    // The poller now ticks at the adopted cadence.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    unmount();
  });

  it('keeps the config reference when unchanged but refreshes syncedAt', async () => {
    const config = { ...BASE_CONFIG, configPollMs: 5_000 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(config));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = mountHook();
    await flush();

    const firstConfig = result.current.config;
    const firstSyncedAt = result.current.syncedAt;
    expect(firstConfig).toEqual(config);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Unchanged payload → the same config object is kept (no-op suppression).
    expect(result.current.config).toBe(firstConfig);
    // But the sync timestamp still advances with the poll.
    expect(result.current.syncedAt).toBe(firstSyncedAt! + 5_000);
  });

  it('aborts a hung fetch and recovers on the next poll without logging an outage', async () => {
    const config = { ...BASE_CONFIG, configPollMs: 5_000 };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fetchMock = vi
      .fn()
      // First call hangs until the abort signal fires (AbortError), like a
      // server that accepts the connection but never responds.
      .mockImplementationOnce((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
      )
      .mockResolvedValue(jsonResponse(config));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = mountHook();
    await flush();
    expect(result.current.config).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The abort timeout fires (10s at the default 15s cadence), clearing the
    // in-flight request. An AbortError is a slow response, not an outage.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await flush();
    expect(errorSpy).not.toHaveBeenCalled();

    // The next poll tick fires a fresh request that resolves normally.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.config).toEqual(config);
    expect(result.current.syncedAt).not.toBeNull();
    // Cadence adoption still applies on the recovery path.
    expect(result.current.pollIntervalMs).toBe(5_000);
  });

  it('logs a genuine outage once, not on every failed poll', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = mountHook();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(result.current.config).toBeNull();
    expect(result.current.syncedAt).toBeNull();

    // Another failed poll doesn't spam the log.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    { reported: 500, expected: 2_000 },
    { reported: 999_999, expected: 600_000 },
  ])('clamps a reported cadence of $reported ms to $expected ms', async ({ reported, expected }) => {
    const config = { ...BASE_CONFIG, configPollMs: reported };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(config));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = mountHook();
    await flush();
    expect(result.current.pollIntervalMs).toBe(expected);
  });
});
