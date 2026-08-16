import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** Enable the mouse-following radial highlight. */
  spotlight?: boolean;
  /** Radial highlight color (defaults to a soft emerald). */
  spotlightColor?: string;
  /** Apply the hover lift/brighten treatment. */
  hover?: boolean;
}

/**
 * Base glass surface used across the dashboard. `spotlight` adds the classic
 * mouse-following radial glow via CSS variables updated on pointer move.
 */
export function GlassCard({
  children,
  className = '',
  spotlight = false,
  spotlightColor = 'rgba(52, 211, 153, 0.10)',
  hover = true,
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={spotlight ? handleMove : undefined}
      className={`glass ${hover ? 'glass-hover' : ''} ${spotlight ? 'spotlight-card' : ''} ${className}`}
      style={{ '--spot-color': spotlightColor } as CSSProperties}
    >
      {children}
    </div>
  );
}
