import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { TouchPress } from './TouchPress';

interface Props {
  icon?: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon = Inbox, title, message, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {message && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{message}</p>}
      {actionLabel && onAction && (
        <TouchPress
          onClick={onAction}
          className="mt-4 h-11 px-5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium shadow-lg shadow-primary/30"
        >
          {actionLabel}
        </TouchPress>
      )}
    </div>
  );
}