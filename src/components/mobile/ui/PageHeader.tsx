import type { ReactNode } from 'react';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Primary action button (always visible) */
  primaryAction?: ReactNode;
  /** Secondary actions: shown inline on desktop, collapsed into overflow menu on mobile */
  secondaryActions?: ReactNode;
  /** Show a back arrow that pops the route */
  showBack?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  showBack,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        'flex items-start gap-3 mb-4 md:mb-6',
        className,
      )}
    >
      {showBack && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          className="tap-target -ml-2 mt-0.5"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!isMobile && secondaryActions}
        {primaryAction}
        {isMobile && secondaryActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions" className="tap-target">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              {secondaryActions}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}