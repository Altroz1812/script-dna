import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartFrameProps {
  children: ReactNode;
  /** Minimum chart width in px to preserve readability when scrolled horizontally */
  minWidth?: number;
  height?: number | string;
  className?: string;
}

/**
 * Horizontally scrollable frame for Recharts/SVG charts on small screens.
 * Keeps chart legible by enforcing a minimum width.
 */
export function ChartFrame({
  children,
  minWidth = 520,
  height = 280,
  className,
}: ChartFrameProps) {
  return (
    <div className={cn('w-full overflow-x-auto hide-scrollbar -mx-1 px-1', className)}>
      <div style={{ minWidth, height }}>{children}</div>
    </div>
  );
}