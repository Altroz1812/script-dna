import { useRef, useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';

interface Props {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
}

const THRESHOLD = 70;

export function PullToRefresh({ onRefresh, children }: Props) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (busy) return;
    const scrollTop = (e.currentTarget as HTMLElement).scrollTop;
    if (scrollTop <= 0) startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null || busy) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(dy * 0.5, 90));
  };
  const onTouchEnd = async () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= THRESHOLD) {
      setBusy(true);
      try {
        await onRefresh();
      } finally {
        setBusy(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  return (
    <div
      className="h-full overflow-y-auto overscroll-contain"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height: pull, transition: pull === 0 ? 'height 200ms ease-out' : 'none' }}
      >
        <RotateCw
          className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${pull * 4}deg)`, opacity: Math.min(pull / THRESHOLD, 1) }}
        />
      </div>
      {children}
    </div>
  );
}