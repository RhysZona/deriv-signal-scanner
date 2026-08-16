import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** Apply the hover lift/brighten treatment. */
  hover?: boolean;
}

/**
 * Base glass surface used across the dashboard.
 */
export function GlassCard({
  children,
  className = '',
  hover = true,
}: GlassCardProps) {
  return (
    <div className={`glass ${hover ? 'glass-hover' : ''} ${className}`}>
      {children}
    </div>
  );
}
