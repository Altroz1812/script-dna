import type { ReactNode } from 'react';
import { PullToRefresh } from './PullToRefresh';

interface Props {
  onRefresh?: () => Promise<unknown> | void;
  children: ReactNode;
}

export function MobilePage({ onRefresh, children }: Props) {
  const inner = (
    <div className="mx-auto w-full max-w-md md:max-w-2xl px-4 pb-6 pt-3 space-y-5">
      {children}
    </div>
  );
  if (onRefresh) return <PullToRefresh onRefresh={onRefresh}>{inner}</PullToRefresh>;
  return <div className="h-full overflow-y-auto overscroll-contain">{inner}</div>;
}