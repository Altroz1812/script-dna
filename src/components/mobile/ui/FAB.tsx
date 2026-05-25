import type { LucideIcon } from 'lucide-react';
import { TouchPress } from './TouchPress';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  label?: string;
  onClick: () => void;
  className?: string;
}

export function FAB({ icon: Icon, label, onClick, className }: Props) {
  return (
    <TouchPress
      onClick={onClick}
      aria-label={label}
      className={cn(
        'fixed right-4 z-30 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl shadow-primary/40 flex items-center justify-center',
        'bottom-[calc(env(safe-area-inset-bottom)+5rem)]',
        className,
      )}
    >
      <Icon className="w-6 h-6" />
    </TouchPress>
  );
}