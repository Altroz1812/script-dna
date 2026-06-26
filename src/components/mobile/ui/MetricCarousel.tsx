import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCarouselProps {
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal snap-scroll on mobile, responsive grid on >=md.
 * Wrap each metric tile as a direct child.
 */
export function MetricCarousel({ children, className }: MetricCarouselProps) {
  return (
    <div
      className={cn(
        'flex gap-3 overflow-x-auto snap-x-mandatory hide-scrollbar -mx-4 px-4 pb-1',
        'md:mx-0 md:px-0 md:overflow-visible md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4',
        '[&>*]:snap-start-always [&>*]:shrink-0 [&>*]:w-[78%] sm:[&>*]:w-[45%]',
        'md:[&>*]:w-auto md:[&>*]:shrink',
        className,
      )}
    >
      {children}
    </div>
  );
}