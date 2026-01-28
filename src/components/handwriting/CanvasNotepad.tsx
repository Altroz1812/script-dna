import { useRef, useEffect, useCallback } from 'react';
import { StrokePoint, StrokeData, OverlayType } from '@/types/handwriting';
import { cn } from '@/lib/utils';

interface CanvasNotepadProps {
  strokes: StrokeData[];
  currentStroke: StrokePoint[];
  penColor: string;
  brushWidth: number;
  overlay: OverlayType;
  onStartStroke: (x: number, y: number, pressure: number) => void;
  onContinueStroke: (x: number, y: number, pressure: number) => void;
  onEndStroke: () => void;
}

export function CanvasNotepad({
  strokes,
  currentStroke,
  penColor,
  brushWidth,
  overlay,
  onStartStroke,
  onContinueStroke,
  onEndStroke,
}: CanvasNotepadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getPointerPosition = useCallback((e: React.PointerEvent): { x: number; y: number; pressure: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure || 0.5,
    };
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, points: StrokePoint[], color: string, width: number) => {
    if (points.length < 2) return;
    
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const prevPoint = points[i - 1];
      
      // Variable width based on pressure
      const pressureWidth = width * (0.5 + point.pressure * 0.5);
      ctx.lineWidth = pressureWidth;
      
      // Smooth curve using quadratic bezier
      const midX = (prevPoint.x + point.x) / 2;
      const midY = (prevPoint.y + point.y) / 2;
      ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
    }
    
    ctx.stroke();
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = 'hsl(220, 14%, 4%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw all strokes
    strokes.forEach(stroke => {
      drawStroke(ctx, stroke.points, stroke.color, stroke.width);
    });
    
    // Draw current stroke
    if (currentStroke.length > 0) {
      drawStroke(ctx, currentStroke, penColor, brushWidth);
    }
  }, [strokes, currentStroke, penColor, brushWidth, drawStroke]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
      
      redrawCanvas();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [redrawCanvas]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y, pressure } = getPointerPosition(e);
    onStartStroke(x / window.devicePixelRatio, y / window.devicePixelRatio, pressure);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y, pressure } = getPointerPosition(e);
    onContinueStroke(x / window.devicePixelRatio, y / window.devicePixelRatio, pressure);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    onEndStroke();
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full h-full min-h-[400px] canvas-container",
        overlay === 'grid' && "grid-overlay",
        overlay === 'lines' && "lines-overlay"
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      
      {/* Canvas Label */}
      <div className="absolute top-3 left-3 px-2 py-1 bg-background/60 backdrop-blur-sm rounded text-xs font-mono text-muted-foreground">
        CANVAS • 60Hz Capture
      </div>
    </div>
  );
}
