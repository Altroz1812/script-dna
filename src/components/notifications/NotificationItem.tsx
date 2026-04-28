import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { timeAgo, type NotificationRow } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: NotificationRow;
  variant?: 'compact' | 'full';
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function NotificationItem({
  notification: n,
  variant = 'compact',
  onMarkRead,
  onMarkUnread,
  onDelete,
}: NotificationItemProps) {
  const padding = variant === 'full' ? 'px-4 py-4' : 'px-4 py-3';
  return (
    <div
      className={cn(
        'group relative transition-colors',
        padding,
        !n.read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            'mt-1.5 h-2 w-2 rounded-full shrink-0',
            !n.read ? 'bg-primary shadow-[0_0_6px_hsl(var(--primary))]' : 'bg-muted-foreground/30'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('font-medium leading-tight', variant === 'full' ? 'text-base' : 'text-sm truncate')}>
              {n.title}
            </p>
            <Badge
              variant={n.read ? 'outline' : 'default'}
              className="h-4 px-1.5 text-[9px] uppercase tracking-wide shrink-0"
            >
              {n.read ? 'Read' : 'Unread'}
            </Badge>
          </div>
          <p
            className={cn(
              'text-muted-foreground mt-0.5',
              variant === 'full' ? 'text-sm' : 'text-xs line-clamp-2'
            )}
          >
            {n.message}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-[10px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
            <div className="flex items-center gap-2">
              {!n.read && onMarkRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(n.id);
                  }}
                  className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                  aria-label="Mark as read"
                >
                  <Check className="h-3 w-3" />
                  Mark read
                </button>
              )}
              {n.read && onMarkUnread && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkUnread(n.id);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  aria-label="Mark as unread"
                >
                  <RotateCcw className="h-3 w-3" />
                  Unread
                </button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onDelete(n.id)}
                  aria-label="Delete notification"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
