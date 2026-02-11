import { useRef, useEffect, useCallback, useState } from 'react';
import { StrokePoint, StrokeData, ShapeSuggestion } from '@/types/handwriting';
import { WritingMode } from '@/types/writingAssistance';
import { cn } from '@/lib/utils';
import { useWritingAssistance } from '@/hooks/useWritingAssistance';
import { useShapeDetector } from '@/hooks/useShapeDetector';
import { WritingAssistanceOverlay } from './WritingAssistanceOverlay';
import { WritingModeToggle } from './WritingModeToggle';
import { ShapeCorrectionOverlay } from './ShapeCorrectionOverlay';

interface FourLineCanvasProps {
  strokes: StrokeData[];
  currentStroke: StrokePoint[];
  penColor: string;
  brushWidth: number;
  targetCharacter: string | null;
  onStartStroke: (x: number, y: number, pressure: number) => void;
  onContinueStroke: (x: number, y: number, pressure: number) => void;
  onEndStroke: () => void;
  onReplaceLastStroke?: (points: StrokePoint[]) => void;
  onOutOfBounds?: () => void;
  onCanvasSizeChange?: (height: number) => void;
}

// Line positions as percentages of canvas height
const LINE_CONFIG = {
  ascender: 15,    // Top dotted line (for ascenders like 'b', 'd', 'h')
  xHeight: 40,     // Upper solid line (cap height / x-height)
  baseline: 70,    // Main baseline (where letters sit)
  descender: 90,   // Bottom dotted line (for descenders like 'g', 'p', 'y')
};

export function FourLineCanvas({
  strokes,
  currentStroke,
  penColor,
  brushWidth,
  targetCharacter,
  onStartStroke,
  onContinueStroke,
  onEndStroke,
  onReplaceLastStroke,
  onOutOfBounds,
  onCanvasSizeChange,
}: FourLineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isOutOfBounds, setIsOutOfBounds] = useState(false);
  const [shapeSuggestion, setShapeSuggestion] = useState<ShapeSuggestion | null>(null);

  const { detectShape } = useShapeDetector();

  // Writing Assistance System
  const {
    state: assistanceState,
    config: assistanceConfig,
    setMode,
    updateConfig,
    applyMagneticSnap,
    issues,
    curveAnalysis,
  } = useWritingAssistance({
    currentStroke,
    targetCharacter,
    canvasHeight: canvasSize.height,
  });

  // Calculate the allowed writing zone
  const getWritingZone = useCallback(() => {
    const padding = canvasSize.height * 0.05;
    return {
      top: (canvasSize.height * LINE_CONFIG.ascender / 100) - padding,
      bottom: (canvasSize.height * LINE_CONFIG.descender / 100) + padding,
    };
  }, [canvasSize.height]);

  const isPointInBounds = useCallback((y: number): boolean => {
    const zone = getWritingZone();
    return y >= zone.top && y <= zone.bottom;
  }, [getWritingZone]);

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
      const pressureWidth = width * (0.5 + point.pressure * 0.5);
      ctx.lineWidth = pressureWidth;
      const midX = (prevPoint.x + point.x) / 2;
      const midY = (prevPoint.y + point.y) / 2;
      ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
    }
    
    ctx.stroke();
  }, []);

  const drawGuideLines = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const dpr = window.devicePixelRatio;
    
    // Ascender line (dotted)
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'hsl(217, 91%, 60%)'; // Primary blue
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ascenderY = height * LINE_CONFIG.ascender / 100;
    ctx.moveTo(0, ascenderY);
    ctx.lineTo(width, ascenderY);
    ctx.stroke();

    // X-height line (solid)
    ctx.setLineDash([]);
    ctx.strokeStyle = 'hsl(173, 80%, 40%)'; // Accent teal
    ctx.lineWidth = 2;
    ctx.beginPath();
    const xHeightY = height * LINE_CONFIG.xHeight / 100;
    ctx.moveTo(0, xHeightY);
    ctx.lineTo(width, xHeightY);
    ctx.stroke();

    // Baseline (thick solid)
    ctx.strokeStyle = 'hsl(210, 20%, 70%)'; // Light foreground
    ctx.lineWidth = 3;
    ctx.beginPath();
    const baselineY = height * LINE_CONFIG.baseline / 100;
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.stroke();

    // Descender line (dotted)
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'hsl(0, 72%, 51%)'; // Destructive red
    ctx.lineWidth = 1;
    ctx.beginPath();
    const descenderY = height * LINE_CONFIG.descender / 100;
    ctx.moveTo(0, descenderY);
    ctx.lineTo(width, descenderY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'hsl(215, 16%, 55%)';
    ctx.fillText('Ascender', 8, ascenderY - 4);
    ctx.fillText('X-Height', 8, xHeightY - 4);
    ctx.fillText('Baseline', 8, baselineY - 4);
    ctx.fillText('Descender', 8, descenderY - 4);

    // Writing zone indicator
    const zone = {
      top: height * LINE_CONFIG.ascender / 100 - height * 0.05,
      bottom: height * LINE_CONFIG.descender / 100 + height * 0.05,
    };
    
    ctx.fillStyle = 'hsla(217, 91%, 60%, 0.03)';
    ctx.fillRect(0, zone.top, width, zone.bottom - zone.top);
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    
    // Clear canvas
    ctx.fillStyle = 'hsl(220, 14%, 4%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw guide lines
    drawGuideLines(ctx, width, height);
    
    // Draw all strokes
    strokes.forEach(stroke => {
      drawStroke(ctx, stroke.points, stroke.color, stroke.width);
    });
    
    // Draw current stroke
    if (currentStroke.length > 0) {
      drawStroke(ctx, currentStroke, penColor, brushWidth);
    }
  }, [strokes, currentStroke, penColor, brushWidth, drawStroke, drawGuideLines]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      setCanvasSize({ width: rect.width, height: rect.height });
      onCanvasSizeChange?.(rect.height);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      redrawCanvas();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [redrawCanvas, onCanvasSizeChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y, pressure } = getPointerPosition(e);
    const normalizedY = y / window.devicePixelRatio;
    
    if (!isPointInBounds(normalizedY)) {
      setIsOutOfBounds(true);
      onOutOfBounds?.();
      return;
    }
    
    setIsOutOfBounds(false);
    onStartStroke(x / window.devicePixelRatio, normalizedY, pressure);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y, pressure } = getPointerPosition(e);
    const normalizedY = y / window.devicePixelRatio;
    
    if (!isPointInBounds(normalizedY)) {
      if (!isOutOfBounds) {
        setIsOutOfBounds(true);
      }
      return;
    }
    
    setIsOutOfBounds(false);
    
    // Apply magnetic snapping in perfection mode
    if (assistanceConfig.mode === 'perfection') {
      const snappedPoint = applyMagneticSnap({
        x: x / window.devicePixelRatio,
        y: normalizedY,
        pressure,
        velocity: 0,
        timestamp: Date.now(),
      });
      onContinueStroke(snappedPoint.x, snappedPoint.y, pressure);
    } else {
      onContinueStroke(x / window.devicePixelRatio, normalizedY, pressure);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    const completedPoints = [...currentStroke];
    onEndStroke();
    setIsOutOfBounds(false);
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);

    // Run shape detection on completed stroke
    if (completedPoints.length >= 8) {
      const lastStrokeId = strokes.length > 0 ? strokes[strokes.length - 1].id : crypto.randomUUID();
      const suggestion = detectShape(completedPoints, lastStrokeId);
      setShapeSuggestion(suggestion);
    }
  };

  const handleAcceptShape = () => {
    if (shapeSuggestion && onReplaceLastStroke) {
      onReplaceLastStroke(shapeSuggestion.correctedPoints);
    }
    setShapeSuggestion(null);
  };

  const handleRejectShape = () => {
    setShapeSuggestion(null);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full h-full min-h-[300px] canvas-container",
        isOutOfBounds && "ring-2 ring-destructive/50"
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

      {/* Writing Assistance Overlay */}
      <WritingAssistanceOverlay
        issues={issues}
        currentStroke={currentStroke}
        mode={assistanceConfig.mode}
        curveAnalysis={curveAnalysis}
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
        ghostOpacity={assistanceConfig.ghostOpacity}
      />

      {/* Shape Correction Overlay */}
      {shapeSuggestion && (
        <ShapeCorrectionOverlay
          suggestion={shapeSuggestion}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          onAccept={handleAcceptShape}
          onReject={handleRejectShape}
        />
      )}
      
      {/* Target Character Display - Centered Ghost Guide */}
      {targetCharacter && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[180px] font-serif text-muted-foreground/10 select-none leading-none" style={{ marginTop: '-5%' }}>
            {targetCharacter}
          </span>
        </div>
      )}
      
      {/* Writing Mode Toggle */}
      <div className="absolute top-3 left-3 z-10">
        <WritingModeToggle
          mode={assistanceConfig.mode}
          config={assistanceConfig}
          onModeChange={setMode}
          onConfigChange={updateConfig}
        />
      </div>

      {/* Target Character Label */}
      {targetCharacter && (
        <div className="absolute top-3 right-3 px-3 py-1.5 bg-primary/20 border border-primary/40 rounded-lg">
          <span className="text-lg font-mono font-bold text-primary">{targetCharacter}</span>
        </div>
      )}

      {/* Out of bounds warning */}
      {isOutOfBounds && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-destructive/90 text-destructive-foreground rounded-lg text-xs font-medium animate-pulse">
          Write between the guide lines!
        </div>
      )}
    </div>
  );
}
