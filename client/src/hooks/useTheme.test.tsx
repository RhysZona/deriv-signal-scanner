import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type UseTheme = () => { theme: 'dark' | 'light'; toggleTheme: () => void };

interface MediaListener {
  (e: { matches: boolean }): void;
}

/** jsdom lacks matchMedia — stub it and collect change listeners. */
function stubMatchMedia(matches: boolean, listeners: MediaListener[] = []) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: (_type: string, cb: MediaListener) => listeners.push(cb),
    removeEventListener: (_type: string, cb: MediaListener) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  })));
}

let useTheme: UseTheme;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('./useTheme');
  useTheme = mod.useTheme;
  localStorage.clear();
  document.documentElement.classList.remove('light');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useTheme', () => {
  it('defaults to dark when the system prefers dark and nothing is saved', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(localStorage.getItem('scanner_theme')).toBeNull();
  });

  it('follows the system light preference when nothing is saved', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    // A system-derived theme is never persisted.
    expect(localStorage.getItem('scanner_theme')).toBeNull();
  });

  it('lets a saved preference win over the system', () => {
    localStorage.setItem('scanner_theme', 'dark');
    stubMatchMedia(true); // system says light, but the saved choice says dark
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('updates live when the system preference changes, before any explicit choice', () => {
    const listeners: MediaListener[] = [];
    stubMatchMedia(false, listeners);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => {
      listeners.forEach(cb => cb({ matches: true }));
    });
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('persists an explicit toggle and stops following the system after it', () => {
    const listeners: MediaListener[] = [];
    stubMatchMedia(false, listeners);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem('scanner_theme')).toBe('light');

    // The system flips to dark, but the explicit choice holds.
    act(() => {
      listeners.forEach(cb => cb({ matches: false }));
    });
    expect(result.current.theme).toBe('light');
  });

  it('starts from the saved theme on a fresh mount', () => {
    localStorage.setItem('scanner_theme', 'light');
    stubMatchMedia(false); // system prefers dark
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
