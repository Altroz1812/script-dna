import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
  /** Offset for bottom tab bar (default 4rem) */
  offsetBottom?: string;
}

/**
 * Mobile sticky action bar pinned above the bottom tab navigation.
 * On desktop it renders as a normal flex row at the bottom of its parent.
 */
export function StickyActionBar({
  children,
  className,
  offsetBottom = '4rem',
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        'md:static md:p-0 md:bg-transparent md:backdrop-blur-0 md:border-0',
        'fixed left-0 right-0 z-30 px-4 py-3',
        'bg-background/95 backdrop-blur border-t border-border/40',
        'flex gap-2 [&>*]:flex-1 md:[&>*]:flex-none md:justify-end',
        className,
      )}
      style={{
        bottom: `calc(${offsetBottom} + env(safe-area-inset-bottom))`,
      }}
    >
      {children}
    </div>
  );
}