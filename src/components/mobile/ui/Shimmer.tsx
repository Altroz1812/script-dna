import { cn } from '@/lib/utils';

function Bar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md bg-gradient-to-r from-white/[0.04] via-white/[0.10] to-white/[0.04] bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  );
}

export function ShimmerStat({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-white/[0.06] bg-card/40 p-4 space-y-3', className)}>
      <Bar className="h-9 w-9 rounded-xl" />
      <Bar className="h-6 w-16" />
      <Bar className="h-3 w-20" />
    </div>
  );
}

export function ShimmerCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-white/[0.06] bg-card/40 p-4 space-y-3', className)}>
      <Bar className="h-4 w-2/3" />
      <Bar className="h-3 w-full" />
      <Bar className="h-3 w-4/5" />
    </div>
  );
}

export function ShimmerRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-white/[0.06] bg-card/40 p-3', className)}>
      <Bar className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Bar className="h-3 w-1/2" />
        <Bar className="h-2 w-1/3" />
      </div>
    </div>
  );
}

export function ShimmerRing() {
  return (
    <div className="flex items-center justify-center py-6">
      <Bar className="h-36 w-36 rounded-full" />
    </div>
  );
}