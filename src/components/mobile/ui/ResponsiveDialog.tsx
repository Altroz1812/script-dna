import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Desktop max width class, e.g. "sm:max-w-lg" */
  desktopWidthClass?: string;
}

/**
 * Renders as a centered Dialog on >=md screens and as a bottom Sheet on mobile.
 * Footer is sticky on mobile to keep primary CTAs above the keyboard area.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
  desktopWidthClass = 'sm:max-w-lg',
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            'h-[92dvh] max-h-[92dvh] p-0 flex flex-col rounded-t-2xl safe-bottom',
            className,
          )}
        >
          {(title || description) && (
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 text-left">
              {title && <SheetTitle>{title}</SheetTitle>}
              {description && <SheetDescription>{description}</SheetDescription>}
            </SheetHeader>
          )}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {children}
          </div>
          {footer && (
            <SheetFooter
              className="px-5 py-3 border-t border-border/40 bg-background/95 backdrop-blur sticky bottom-0 flex-row gap-2 [&>*]:flex-1"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
            >
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(desktopWidthClass, 'max-h-[85vh] flex flex-col', className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}