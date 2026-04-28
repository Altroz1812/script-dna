import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

interface MarkAllReadButtonProps {
  className?: string;
  size?: 'sm' | 'default';
  variant?: 'ghost' | 'outline' | 'secondary' | 'default';
  hideWhenEmpty?: boolean;
}

export function MarkAllReadButton({
  className,
  size = 'sm',
  variant = 'ghost',
  hideWhenEmpty = false,
}: MarkAllReadButtonProps) {
  const { unreadCount, markAllRead } = useNotifications({ toastOnInsert: false });
  if (hideWhenEmpty && unreadCount === 0) return null;
  return (
    <Button
      variant={variant}
      size={size}
      onClick={markAllRead}
      disabled={unreadCount === 0}
      className={cn('text-xs', className)}
    >
      <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
      Mark all read{unreadCount > 0 ? ` (${unreadCount})` : ''}
    </Button>
  );
}
