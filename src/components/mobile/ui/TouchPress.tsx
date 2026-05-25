import { forwardRef, type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from '@/lib/utils';

type Props<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export const TouchPress = forwardRef<HTMLElement, Props<any>>(function TouchPress(
  { as, className, ...rest }: any,
  ref,
) {
  const Comp = (as ?? 'button') as ElementType;
  return (
    <Comp
      ref={ref as any}
      className={cn(
        'select-none transition-transform duration-150 ease-out active:scale-[0.97] touch-manipulation',
        className,
      )}
      {...rest}
    />
  );
});