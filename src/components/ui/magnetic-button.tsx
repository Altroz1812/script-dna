import { useRef, type ReactNode, type MouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  strength?: number;
}

export function MagneticButton({ children, className, onClick, strength = 0.3 }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 200, damping: 15 });
  const springY = useSpring(y, { stiffness: 200, damping: 15 });
  const scale = useSpring(1, { stiffness: 300, damping: 20 });

  const handleMouseMove = (e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    scale.set(1);
  };

  const handleMouseDown = () => scale.set(0.95);
  const handleMouseUp = () => scale.set(1.05);

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={onClick}
      style={{ x: springX, y: springY, scale }}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 overflow-hidden',
        'rounded-xl px-5 py-2.5 font-medium text-sm',
        'bg-gradient-to-r from-primary via-coral to-accent text-primary-foreground',
        'transition-shadow duration-300',
        'hover:shadow-[0_0_30px_hsl(265_90%_65%/0.3)]',
        className,
      )}
    >
      {/* Liquid ripple layer */}
      <span className="absolute inset-0 overflow-hidden rounded-xl">
        <span className="absolute inset-0 bg-gradient-to-r from-primary via-coral to-accent opacity-0 hover:opacity-100 transition-opacity duration-500 animate-gradient-morph" 
          style={{ backgroundSize: '200% 200%' }} 
        />
      </span>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
