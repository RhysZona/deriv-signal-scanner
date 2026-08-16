import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'scanner_theme';

function getSavedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage unavailable — treated as no saved preference.
  }
  return null;
}

function getSystemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** True while a view transition is in flight — used to avoid stacking them. */
let transitionInFlight = false;

/**
 * Apply a theme change. When the View Transitions API is available (and motion
 * isn't reduced), the change is wrapped in startViewTransition so the browser
 * cross-fades the entire page — gradients, aurora and all. flushSync forces
 * React to commit the DOM update inside the transition callback so the
 * "after" snapshot is captured correctly. Falls back to an instant swap.
 */
function applyThemeChange(next: Theme, commit: (next: Theme) => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => {
      finished?: Promise<unknown>;
      ready?: Promise<unknown>;
      updateCallbackDone?: Promise<unknown>;
    } | undefined;
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!doc.startViewTransition || reducedMotion || transitionInFlight) {
    // No transition possible, motion reduced, or one is already running — an
    // instant swap (or re-using the running one's already-committed DOM) is
    // correct and avoids stacking/aborting overlapping transitions.
    commit(next);
    return;
  }

  let committed = false;
  transitionInFlight = true;
  // Called as a method so `this` stays bound to the document.
  const transition = doc.startViewTransition(() => {
    flushSync(() => {
      commit(next);
      committed = true;
    });
  });
  // If the browser skips/aborts the transition (e.g. no compositor, background
  // tab, or a second toggle mid-flight), the callback above may never run — the
  // theme must still land, so commit as a fallback. Committing the same value
  // twice is a harmless no-op for React state. Abort rejections on the other
  // view-transition promises are swallowed: they're expected when a transition
  // is interrupted and carry no state we need.
  if (transition) {
    const swallow = (p: Promise<unknown> | undefined) => p?.catch(() => {});
    swallow(transition.updateCallbackDone);
    swallow(transition.ready);
    transition.finished?.then(
      () => { transitionInFlight = false; },
      () => {
        transitionInFlight = false;
        if (!committed) commit(next);
      },
    );
  } else {
    transitionInFlight = false;
  }
}

/**
 * Dark/light theme state. Resolution order:
 *   1. saved preference (localStorage)
 *   2. the system's prefers-color-scheme
 *   3. dark (the trading-terminal default)
 *
 * The system preference is only followed while the user hasn't made an explicit
 * choice — it even updates live if the OS theme changes. The first manual
 * toggle persists the choice and stops tracking system changes. The active
 * theme is applied as the `.light` class on <html> (CSS variables in index.css
 * do the rest), so it stays consistent with the pre-paint script in index.html.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => getSavedTheme() ?? getSystemTheme());
  const [explicit, setExplicit] = useState<boolean>(() => getSavedTheme() !== null);
  const explicitRef = useRef(explicit);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Follow live system preference changes only until the user chooses.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e: MediaQueryListEvent) => {
      if (!explicitRef.current) {
        applyThemeChange(e.matches ? 'light' : 'dark', setTheme);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply the theme and persist only explicit choices.
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    if (explicit) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Theme still applies for this session.
      }
    }
  }, [theme, explicit]);

  const toggleTheme = useCallback(() => {
    const next = themeRef.current === 'dark' ? 'light' : 'dark';
    setExplicit(true);
    explicitRef.current = true;
    applyThemeChange(next, setTheme);
  }, []);

  return { theme, toggleTheme };
}
