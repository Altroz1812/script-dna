import { useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  /** Bento grid span: '2x1' | '1x2' | '2x2' | '1x1' (default) */
  span?: '1x1' | '2x1' | '1x2' | '2x2';
}

const spanClasses: Record<string, string> = {
  '1x1': '',
  '2x1': 'md:col-span-2',
  '1x2': 'md:row-span-2',
  '2x2': 'md:col-span-2 md:row-span-2',
};

export function TiltCard({ children, className, glowColor = 'hsl(265 90% 65%)', span = '1x1' }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [8, -8]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-8, 8]), { stiffness: 200, damping: 20 });

  const handleMouseMove = (e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
      className={cn(
        'relative rounded-2xl border border-white/[0.08] overflow-hidden',
        'bg-card transition-shadow duration-500',
        spanClasses[span],
        className,
      )}
    >
      {/* Gradient glow that follows mouse */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-500"
        style={{
          opacity: isHovered ? 0.12 : 0,
          background: `radial-gradient(600px circle at ${mouseX.get() * 100}% ${mouseY.get() * 100}%, ${glowColor}, transparent 40%)`,
        }}
      />

      {/* Noise texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] rounded-2xl"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Content with depth transform */}
      <div style={{ transform: 'translateZ(20px)', transformStyle: 'preserve-3d' }} className="relative z-10">
        {children}
      </div>

      {/* Subtle border glow on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          border: '1px solid transparent',
          backgroundImage: isHovered
            ? 'linear-gradient(135deg, hsl(265 90% 65% / 0.2), hsl(12 90% 65% / 0.1), hsl(165 80% 45% / 0.2))'
            : 'none',
          backgroundOrigin: 'border-box',
          backgroundClip: 'border-box',
          mask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      />
    </motion.div>
  );
}
