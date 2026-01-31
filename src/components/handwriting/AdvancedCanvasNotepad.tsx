import { useRef, useEffect, useCallback, useState } from 'react';
import { StrokePoint, StrokeData, OverlayType } from '@/types/handwriting';
import { cn } from '@/lib/utils';

interface AdvancedCanvasNotepadProps {
  strokes: StrokeData[];
  currentStroke: StrokePoint[];
  penColor: string;
  brushWidth: number;
  overlay: OverlayType;
  slantAngle?: number;
  onStartStroke: (x: number, y: number, pressure: number, event?: PointerEvent) => void;
  onContinueStroke: (x: number, y: number, pressure: number, event?: PointerEvent) => void;
  onEndStroke: () => void;
}

export function AdvancedCanvasNotepad({
  strokes,
  currentStroke,
  penColor,
  brushWidth,
  overlay,
  slantAngle = 75,
  onStartStroke,
  onContinueStroke,
  onEndStroke,
}: AdvancedCanvasNotepadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pointerType, setPointerType] = useState<string>('mouse');

  // Get position from pointer event with sub-pixel precision
  const getPointerPosition = useCallback((e: PointerEvent): { x: number; y: number; pressure: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Use sub-pixel precision
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    
    return {
      x,
      y,
      pressure: e.pressure || 0.5,
    };
  }, []);

  // Draw a single stroke with variable width and smooth curves
  const drawStroke = useCallback((
    ctx: CanvasRenderingContext2D, 
    points: StrokePoint[], 
    color: string, 
    width: number
  ) => {
    if (points.length < 2) {
      if (points.length === 1) {
        // Single point - draw a dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, width * points[0].pressure * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw stroke segments with variable width
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const prevPoint = points[i - 1];
      
      // Skip predicted points in final rendering
      if (point.isPredicted && i === points.length - 1) continue;
      
      // Variable width based on pressure
      const pressureWidth = width * (0.3 + point.pressure * 0.7);
      ctx.lineWidth = pressureWidth;
      
      ctx.beginPath();
      
      if (i === 1) {
        // First segment - straight line
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(point.x, point.y);
      } else {
        // Use quadratic bezier for smoothness
        const prevPrevPoint = points[i - 2];
        const midX = (prevPoint.x + point.x) / 2;
        const midY = (prevPoint.y + point.y) / 2;
        
        ctx.moveTo(
          (prevPrevPoint.x + prevPoint.x) / 2,
          (prevPrevPoint.y + prevPoint.y) / 2
        );
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
      }
      
      ctx.stroke();
    }
  }, []);

  // Draw overlay guides
  const drawOverlay = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)';
    ctx.lineWidth = 1;
    
    switch (overlay) {
      case 'grid': {
        const gridSize = 30;
        for (let x = gridSize; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = gridSize; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        break;
      }
      
      case 'ruled':
      case 'lines': {
        const lineSpacing = 35;
        for (let y = lineSpacing; y < height; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        break;
      }
      
      case 'fourline': {
        // 4-line handwriting grid (ascender, x-height, baseline, descender)
        const groupHeight = 100;
        const groups = Math.ceil(height / groupHeight);
        
        for (let g = 0; g < groups; g++) {
          const baseY = g * groupHeight + 20;
          
          // Ascender line (dashed)
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
          ctx.beginPath();
          ctx.moveTo(0, baseY);
          ctx.lineTo(width, baseY);
          ctx.stroke();
          
          // X-height line (dotted)
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.beginPath();
          ctx.moveTo(0, baseY + 25);
          ctx.lineTo(width, baseY + 25);
          ctx.stroke();
          
          // Baseline (solid)
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, baseY + 50);
          ctx.lineTo(width, baseY + 50);
          ctx.stroke();
          ctx.lineWidth = 1;
          
          // Descender line (dashed)
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
          ctx.beginPath();
          ctx.moveTo(0, baseY + 75);
          ctx.lineTo(width, baseY + 75);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        break;
      }
      
      case 'slant': {
        // Slant-aligned grid
        const spacing = 40;
        const angleRad = (slantAngle * Math.PI) / 180;
        const tan = Math.tan(angleRad);
        
        // Vertical slant lines
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
        for (let x = -height; x < width + height; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x, height);
          ctx.lineTo(x + height / tan, 0);
          ctx.stroke();
        }
        
        // Horizontal lines
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)';
        for (let y = spacing; y < height; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        break;
      }
    }
  }, [overlay, slantAngle]);

  // Redraw main canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // Clear with background
    ctx.fillStyle = 'hsl(220, 14%, 4%)';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Draw all completed strokes
    strokes.forEach(stroke => {
      drawStroke(ctx, stroke.points, stroke.color, stroke.width);
    });
    
    // Draw current stroke
    if (currentStroke.length > 0) {
      drawStroke(ctx, currentStroke, penColor, brushWidth);
    }
  }, [strokes, currentStroke, penColor, brushWidth, drawStroke]);

  // Setup canvas and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !overlayCanvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      
      // Set canvas size (1:1 with CSS for crisp rendering)
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      overlayCanvas.width = rect.width;
      overlayCanvas.height = rect.height;
      overlayCanvas.style.width = `${rect.width}px`;
      overlayCanvas.style.height = `${rect.height}px`;
      
      // Redraw
      redrawCanvas();
      
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        drawOverlay(overlayCtx, rect.width, rect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [redrawCanvas, drawOverlay]);

  // Redraw on stroke changes
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Redraw overlay when settings change
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    
    const ctx = overlayCanvas.getContext('2d');
    if (ctx) {
      drawOverlay(ctx, overlayCanvas.width, overlayCanvas.height);
    }
  }, [overlay, slantAngle, drawOverlay]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const nativeEvent = e.nativeEvent;
    setPointerType(e.pointerType);
    
    const { x, y, pressure } = getPointerPosition(nativeEvent);
    onStartStroke(x, y, pressure, nativeEvent);
    
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const nativeEvent = e.nativeEvent;
    
    const { x, y, pressure } = getPointerPosition(nativeEvent);
    onContinueStroke(x, y, pressure, nativeEvent);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    onEndStroke();
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden bg-background border border-border/50"
    >
      {/* Overlay canvas (behind) */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      
      {/* Main drawing canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none cursor-crosshair"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      
      {/* Canvas Labels */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className="px-2 py-1 bg-background/60 backdrop-blur-sm rounded text-xs font-mono text-muted-foreground">
          HYBRID VECTOR ENGINE
        </div>
        <div className={cn(
          "px-2 py-1 rounded text-xs font-mono",
          pointerType === 'pen' 
            ? "bg-primary/20 text-primary" 
            : "bg-secondary/60 text-muted-foreground"
        )}>
          {pointerType === 'pen' ? '✎ PENCIL' : pointerType === 'touch' ? '👆 TOUCH' : '🖱 MOUSE'}
        </div>
      </div>
    </div>
  );
}
