import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly animates toward `target` whenever it changes (ease-out cubic).
 * Returns the live interpolated value — render with `.toFixed()`/Math.round.
 */
export function useCountUp(target: number, duration = 700): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    if (displayRef.current === target) return;
    const from = displayRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    // Safety net: if rAF is throttled or paused (background tab, headless
    // capture, energy saver), guarantee the value still converges.
    const safety = setTimeout(() => {
      cancelAnimationFrame(raf);
      if (displayRef.current !== target) {
        displayRef.current = target;
        setDisplay(target);
      }
    }, duration + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
    };
  }, [target, duration]);

  return display;
}
