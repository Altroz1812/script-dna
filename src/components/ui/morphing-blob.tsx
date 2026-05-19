import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MorphingBlobProps {
  className?: string;
  color?: string;
}

export function MorphingBlob({ className, color = 'hsl(217 91% 60% / 0.18)' }: MorphingBlobProps) {
  return (
    <motion.div
      className={cn('absolute rounded-full animate-morph-blob blur-3xl pointer-events-none', className)}
      style={{ background: color }}
      animate={{
        scale: [1, 1.1, 0.95, 1.05, 1],
        x: [0, 10, -5, 8, 0],
        y: [0, -8, 5, -3, 0],
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
