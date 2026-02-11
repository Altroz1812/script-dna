import { useRef, useEffect, useCallback, useState } from 'react';
import { StrokePoint, StrokeData, ShapeSuggestion, CanvasTool } from '@/types/handwriting';
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
  activeTool: CanvasTool;
  targetCharacter: string | null;
  onStartStroke: (x: number, y: number, pressure: number) => void;
  onContinueStroke: (x: number, y: number, pressure: number) => void;
  onEndStroke: () => void;
  onReplaceLastStroke?: (points: StrokePoint[]) => void;
  onEraseAtPoint?: (x: number, y: number, radius: number) => void;
  onStartErase?: () => void;
  onEndErase?: () => void;
  onAddStamp?: (points: StrokePoint[], color: string, width: number) => void;
  onMoveStrokes?: (strokeIds: string[], dx: number, dy: number) => void;
  onScaleStrokes?: (strokeIds: string[], scaleFactor: number) => void;
  onChangeStrokeWidth?: (strokeIds: string[], delta: number) => void;
  onResizeStrokes?: (strokeIds: string[], oldBounds: { minX: number; minY: number; maxX: number; maxY: number }, newBounds: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  onFlipStrokes?: (strokeIds: string[], axis: 'horizontal' | 'vertical') => void;
  onRotateStrokes?: (strokeIds: string[], angleDeg?: number) => void;
  onOutOfBounds?: () => void;
  onCanvasSizeChange?: (height: number) => void;
}

// Line positions as percentages of canvas height — equal 25% spacing
const LINE_CONFIG = {
  ascender: 12.5,  // Top dotted line (for ascenders like 'b', 'd', 'h')
  xHeight: 37.5,   // Upper solid line (cap height / x-height)
  baseline: 62.5,  // Main baseline (where letters sit)
  descender: 87.5, // Bottom dotted line (for descenders like 'g', 'p', 'y')
};

export function FourLineCanvas({
  strokes,
  currentStroke,
  penColor,
  brushWidth,
  activeTool,
  targetCharacter,
  onStartStroke,
  onContinueStroke,
  onEndStroke,
  onReplaceLastStroke,
  onEraseAtPoint,
  onStartErase,
  onEndErase,
  onAddStamp,
  onMoveStrokes,
  onScaleStrokes,
  onChangeStrokeWidth,
  onResizeStrokes,
  onFlipStrokes,
  onRotateStrokes,
  onOutOfBounds,
  onCanvasSizeChange,
}: FourLineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isOutOfBounds, setIsOutOfBounds] = useState(false);
  const [shapeSuggestion, setShapeSuggestion] = useState<ShapeSuggestion | null>(null);
  const [stampDragStart, setStampDragStart] = useState<{ x: number; y: number } | null>(null);
  const [stampPreview, setStampPreview] = useState<StrokePoint[] | null>(null);
  // Select tool state
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);
  const [selectDragStart, setSelectDragStart] = useState<{ x: number; y: number } | null>(null);
  const [selectDragLast, setSelectDragLast] = useState<{ x: number; y: number } | null>(null);
  // Resize handle drag state
  type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const resizeStartBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const resizeOrigBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const resizeAnchorRef = useRef<{ x: number; y: number } | null>(null);

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
      const isSelected = selectedStrokeIds.includes(stroke.id);
      if (isSelected) {
        // Draw selection highlight
        ctx.save();
        ctx.strokeStyle = 'hsl(217, 91%, 60%)';
        ctx.lineWidth = stroke.width + 4;
        ctx.globalAlpha = 0.3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      drawStroke(ctx, stroke.points, stroke.color, stroke.width);
    });
    
    // Draw current stroke
    if (currentStroke.length > 0) {
      drawStroke(ctx, currentStroke, penColor, brushWidth);
    }
  }, [strokes, currentStroke, penColor, brushWidth, drawStroke, drawGuideLines, selectedStrokeIds]);

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

  // Generate stamp points with center and radius
  const generateStampPoints = useCallback((cx: number, cy: number, rx: number, ry: number): StrokePoint[] => {
    const n = 48;
    const now = performance.now();
    const base = { pressure: 0.6, velocity: 0, timestamp: now };

    if (activeTool === 'stamp_circle') {
      const r = Math.max(rx, ry);
      return Array.from({ length: n + 1 }, (_, i) => {
        const angle = (2 * Math.PI * i) / n;
        return { ...base, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), timestamp: now + i };
      });
    }
    if (activeTool === 'stamp_ellipse') {
      return Array.from({ length: n + 1 }, (_, i) => {
        const angle = (2 * Math.PI * i) / n;
        return { ...base, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), timestamp: now + i };
      });
    }
    if (activeTool === 'stamp_rectangle') {
      // 4 corners + close
      const pts: StrokePoint[] = [
        { ...base, x: cx - rx, y: cy - ry, timestamp: now },
        { ...base, x: cx + rx, y: cy - ry, timestamp: now + 1 },
        { ...base, x: cx + rx, y: cy + ry, timestamp: now + 2 },
        { ...base, x: cx - rx, y: cy + ry, timestamp: now + 3 },
        { ...base, x: cx - rx, y: cy - ry, timestamp: now + 4 },
      ];
      return pts;
    }
    if (activeTool === 'stamp_triangle') {
      const r = Math.max(rx, ry);
      return [
        { ...base, x: cx, y: cy - r, timestamp: now },
        { ...base, x: cx + r * 0.87, y: cy + r * 0.5, timestamp: now + 1 },
        { ...base, x: cx - r * 0.87, y: cy + r * 0.5, timestamp: now + 2 },
        { ...base, x: cx, y: cy - r, timestamp: now + 3 },
      ];
    }
    if (activeTool === 'stamp_line') {
      return Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        return { ...base, x: cx - rx + 2 * rx * t, y: cy, timestamp: now + i };
      });
    }
    if (activeTool === 'stamp_arc') {
      const r = Math.max(rx, ry);
      return Array.from({ length: n }, (_, i) => {
        const angle = Math.PI + (Math.PI * i) / (n - 1);
        return { ...base, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), timestamp: now + i };
      });
    }
    if (activeTool === 'stamp_semicircle') {
      const r = Math.max(rx, ry);
      // Semi-circle: half circle (arc) + closing line
      const arcPoints = Array.from({ length: n }, (_, i) => {
        const angle = Math.PI + (Math.PI * i) / (n - 1);
        return { ...base, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), timestamp: now + i };
      });
      // Close with a straight line back to start
      arcPoints.push({ ...base, x: arcPoints[0].x, y: arcPoints[0].y, timestamp: now + n });
      return arcPoints;
    }
    return [];
  }, [activeTool]);

  // Find stroke at a point (for select tool)
  const findStrokeAtPoint = useCallback((px: number, py: number, threshold: number = 10): string | null => {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const stroke = strokes[i];
      for (const p of stroke.points) {
        const dx = p.x - px;
        const dy = p.y - py;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          return stroke.id;
        }
      }
    }
    return null;
  }, [strokes]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y, pressure } = getPointerPosition(e);
    const normalizedX = x / window.devicePixelRatio;
    const normalizedY = y / window.devicePixelRatio;
    
    if (!isPointInBounds(normalizedY)) {
      setIsOutOfBounds(true);
      onOutOfBounds?.();
      return;
    }
    
    setIsOutOfBounds(false);

    // Handle select tool
    if (activeTool === 'select') {
      const hitId = findStrokeAtPoint(normalizedX, normalizedY);
      if (hitId) {
        setSelectedStrokeIds([hitId]);
        setSelectDragStart({ x: normalizedX, y: normalizedY });
        setSelectDragLast({ x: normalizedX, y: normalizedY });
      } else {
        setSelectedStrokeIds([]);
      }
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      return;
    }

    // Handle stamp tools - start drag for sizing
    if (activeTool.startsWith('stamp_')) {
      setStampDragStart({ x: normalizedX, y: normalizedY });
      setStampPreview(null);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      return;
    }

    // Handle eraser
    if (activeTool === 'eraser') {
      onStartErase?.();
      onEraseAtPoint?.(normalizedX, normalizedY, brushWidth);
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      return;
    }

    onStartStroke(normalizedX, normalizedY, pressure);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y, pressure } = getPointerPosition(e);
    const normalizedX = x / window.devicePixelRatio;
    const normalizedY = y / window.devicePixelRatio;
    
    if (!isPointInBounds(normalizedY)) {
      if (!isOutOfBounds) {
        setIsOutOfBounds(true);
      }
      return;
    }
    
    setIsOutOfBounds(false);

    // Select tool: drag to move (skip if resizing via handle)
    if (activeTool === 'select' && selectDragLast && selectedStrokeIds.length > 0 && !resizeHandle) {
      const dx = normalizedX - selectDragLast.x;
      const dy = normalizedY - selectDragLast.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        onMoveStrokes?.(selectedStrokeIds, dx, dy);
        setSelectDragLast({ x: normalizedX, y: normalizedY });
      }
      return;
    }

    // Select tool: resize via handle drag
    if (activeTool === 'select' && resizeHandle && resizeStartBoundsRef.current && resizeAnchorRef.current) {
      const ob = resizeStartBoundsRef.current;
      const anchor = resizeAnchorRef.current;
      let newBounds = { ...ob };
      // Compute new bounds based on handle
      if (resizeHandle.includes('n')) newBounds.minY = normalizedY;
      if (resizeHandle.includes('s')) newBounds.maxY = normalizedY;
      if (resizeHandle.includes('w')) newBounds.minX = normalizedX;
      if (resizeHandle.includes('e')) newBounds.maxX = normalizedX;
      // Enforce minimum size
      if (newBounds.maxX - newBounds.minX < 5) newBounds.maxX = newBounds.minX + 5;
      if (newBounds.maxY - newBounds.minY < 5) newBounds.maxY = newBounds.minY + 5;
      onResizeStrokes?.(selectedStrokeIds, ob, newBounds);
      // Update start bounds for next move delta
      resizeStartBoundsRef.current = newBounds;
      return;
    }

    // Eraser continuous erase
    if (activeTool === 'eraser') {
      onEraseAtPoint?.(normalizedX, normalizedY, brushWidth);
      return;
    }

    // Stamp drag preview
    if (activeTool.startsWith('stamp_') && stampDragStart) {
      const rx = Math.abs(normalizedX - stampDragStart.x);
      const ry = Math.abs(normalizedY - stampDragStart.y);
      const cx = (stampDragStart.x + normalizedX) / 2;
      const cy = (stampDragStart.y + normalizedY) / 2;
      const preview = generateStampPoints(cx, cy, rx / 2 || 10, ry / 2 || 10);
      setStampPreview(preview);
      return;
    }
    
    if (activeTool.startsWith('stamp_')) return;

    // Apply magnetic snapping in perfection mode
    if (assistanceConfig.mode === 'perfection') {
      const snappedPoint = applyMagneticSnap({
        x: normalizedX,
        y: normalizedY,
        pressure,
        velocity: 0,
        timestamp: Date.now(),
      });
      onContinueStroke(snappedPoint.x, snappedPoint.y, pressure);
    } else {
      onContinueStroke(normalizedX, normalizedY, pressure);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);

    // Select tool
    if (activeTool === 'select') {
      setSelectDragStart(null);
      setSelectDragLast(null);
      setResizeHandle(null);
      resizeStartBoundsRef.current = null;
      resizeOrigBoundsRef.current = null;
      resizeAnchorRef.current = null;
      setIsOutOfBounds(false);
      return;
    }

    if (activeTool === 'eraser') {
      onEndErase?.();
      setIsOutOfBounds(false);
      return;
    }

    // Stamp: finalize on pointer up
    if (activeTool.startsWith('stamp_') && stampDragStart) {
      const { x, y } = getPointerPosition(e);
      const normalizedX = x / window.devicePixelRatio;
      const normalizedY = y / window.devicePixelRatio;
      const rx = Math.abs(normalizedX - stampDragStart.x);
      const ry = Math.abs(normalizedY - stampDragStart.y);
      const cx = (stampDragStart.x + normalizedX) / 2;
      const cy = (stampDragStart.y + normalizedY) / 2;
      const finalRx = rx > 5 ? rx / 2 : brushWidth * 4;
      const finalRy = ry > 5 ? ry / 2 : brushWidth * 4;
      const points = generateStampPoints(cx, cy, finalRx, finalRy);
      if (points.length > 0 && onAddStamp) {
        onAddStamp(points, penColor, brushWidth);
      }
      setStampDragStart(null);
      setStampPreview(null);
      setIsOutOfBounds(false);
      return;
    }

    const completedPoints = [...currentStroke];
    onEndStroke();
    setIsOutOfBounds(false);

    // Run shape detection on completed stroke
    if (completedPoints.length >= 6) {
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

      {/* Stamp drag preview */}
      {stampPreview && stampPreview.length > 1 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          preserveAspectRatio="none"
        >
          <path
            d={`M ${stampPreview[0].x} ${stampPreview[0].y} ${stampPreview.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray="6 3"
            opacity="0.6"
          />
        </svg>
      )}

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

      {/* Selection bounding box with resize handles */}
      {selectedStrokeIds.length > 0 && activeTool === 'select' && (() => {
        const selectedStrokes = strokes.filter(s => selectedStrokeIds.includes(s.id));
        const allPts = selectedStrokes.flatMap(s => s.points);
        if (allPts.length === 0) return null;
        const minX = Math.min(...allPts.map(p => p.x));
        const minY = Math.min(...allPts.map(p => p.y));
        const maxX = Math.max(...allPts.map(p => p.x));
        const maxY = Math.max(...allPts.map(p => p.y));
        const pad = 8;
        const currentWidth = selectedStrokes[0]?.width ?? 4;
        const bx = minX - pad;
        const by = minY - pad;
        const bw = maxX - minX + pad * 2;
        const bh = maxY - minY + pad * 2;
        const hs = 8; // handle size
        const handles: { key: ResizeHandle; cx: number; cy: number; cursor: string }[] = [
          { key: 'nw', cx: bx, cy: by, cursor: 'nwse-resize' },
          { key: 'n', cx: bx + bw / 2, cy: by, cursor: 'ns-resize' },
          { key: 'ne', cx: bx + bw, cy: by, cursor: 'nesw-resize' },
          { key: 'e', cx: bx + bw, cy: by + bh / 2, cursor: 'ew-resize' },
          { key: 'se', cx: bx + bw, cy: by + bh, cursor: 'nwse-resize' },
          { key: 's', cx: bx + bw / 2, cy: by + bh, cursor: 'ns-resize' },
          { key: 'sw', cx: bx, cy: by + bh, cursor: 'nesw-resize' },
          { key: 'w', cx: bx, cy: by + bh / 2, cursor: 'ew-resize' },
        ];
        const startResize = (handle: ResizeHandle, e: React.PointerEvent) => {
          e.stopPropagation();
          e.preventDefault();
          setResizeHandle(handle);
          resizeStartBoundsRef.current = { minX: bx, minY: by, maxX: bx + bw, maxY: by + bh };
          resizeOrigBoundsRef.current = { minX: bx, minY: by, maxX: bx + bw, maxY: by + bh };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        };
        return (
          <>
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-[15]"
              viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
              preserveAspectRatio="none"
            >
              <rect
                x={bx} y={by} width={bw} height={bh}
                fill="none" stroke="hsl(217, 91%, 60%)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7"
              />
            </svg>
            {/* Resize handles */}
            {handles.map(h => (
              <div
                key={h.key}
                className="absolute z-20 pointer-events-auto rounded-sm bg-primary border-2 border-primary-foreground shadow-md"
                style={{
                  left: h.cx - hs / 2,
                  top: h.cy - hs / 2,
                  width: hs,
                  height: hs,
                  cursor: h.cursor,
                }}
                onPointerDown={(e) => startResize(h.key, e)}
                onPointerMove={(e) => {
                  if (resizeHandle !== h.key) return;
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect || !resizeStartBoundsRef.current) return;
                  const nx = e.clientX - rect.left;
                  const ny = e.clientY - rect.top;
                  const ob = resizeStartBoundsRef.current;
                  const nb = { ...ob };
                  if (h.key.includes('n')) nb.minY = ny;
                  if (h.key.includes('s')) nb.maxY = ny;
                  if (h.key.includes('w')) nb.minX = nx;
                  if (h.key.includes('e')) nb.maxX = nx;
                  // Shift = proportional resize for corner handles
                  const isCorner = ['nw','ne','sw','se'].includes(h.key);
                  if (e.shiftKey && isCorner && resizeOrigBoundsRef.current) {
                    const origW = resizeOrigBoundsRef.current.maxX - resizeOrigBoundsRef.current.minX;
                    const origH = resizeOrigBoundsRef.current.maxY - resizeOrigBoundsRef.current.minY;
                    if (origW > 0 && origH > 0) {
                      const aspect = origW / origH;
                      let newW = nb.maxX - nb.minX;
                      let newH = nb.maxY - nb.minY;
                      if (newW / newH > aspect) {
                        newW = newH * aspect;
                      } else {
                        newH = newW / aspect;
                      }
                      // Anchor to the opposite corner
                      if (h.key.includes('e')) nb.maxX = nb.minX + newW; else nb.minX = nb.maxX - newW;
                      if (h.key.includes('s')) nb.maxY = nb.minY + newH; else nb.minY = nb.maxY - newH;
                    }
                  }
                  if (nb.maxX - nb.minX < 5) nb.maxX = nb.minX + 5;
                  if (nb.maxY - nb.minY < 5) nb.maxY = nb.minY + 5;
                  onResizeStrokes?.(selectedStrokeIds, ob, nb);
                  resizeStartBoundsRef.current = nb;
                }}
                onPointerUp={(e) => {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                  setResizeHandle(null);
                  resizeStartBoundsRef.current = null;
                  resizeOrigBoundsRef.current = null;
                }}
              />
            ))}
            {/* Scale & thickness controls */}
            <div
              className="absolute pointer-events-auto flex flex-col gap-1.5 z-20"
              style={{ left: bx + bw + 14, top: by }}
            >
              <div className="flex items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground w-7">Size</span>
                <button onClick={() => onScaleStrokes?.(selectedStrokeIds, 1.15)} className="w-6 h-6 rounded bg-card/90 border border-border text-foreground text-xs font-bold hover:bg-accent/30" title="Scale up">+</button>
                <button onClick={() => onScaleStrokes?.(selectedStrokeIds, 0.85)} className="w-6 h-6 rounded bg-card/90 border border-border text-foreground text-xs font-bold hover:bg-accent/30" title="Scale down">−</button>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground w-7">Wt</span>
                <button onClick={() => onChangeStrokeWidth?.(selectedStrokeIds, 1)} className="w-6 h-6 rounded bg-card/90 border border-border text-foreground text-xs font-bold hover:bg-accent/30" title="Increase thickness">+</button>
                <button onClick={() => onChangeStrokeWidth?.(selectedStrokeIds, -1)} className="w-6 h-6 rounded bg-card/90 border border-border text-foreground text-xs font-bold hover:bg-accent/30" title="Decrease thickness">−</button>
                <span className="text-[9px] font-mono text-muted-foreground ml-0.5">{currentWidth}px</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground w-7">Flip</span>
                <button onClick={() => onFlipStrokes?.(selectedStrokeIds, 'horizontal')} className="w-6 h-6 rounded bg-card/90 border border-border text-foreground text-[9px] font-bold hover:bg-accent/30" title="Flip Horizontal">H</button>
                <button onClick={() => onFlipStrokes?.(selectedStrokeIds, 'vertical')} className="w-6 h-6 rounded bg-card/90 border border-border text-foreground text-[9px] font-bold hover:bg-accent/30" title="Flip Vertical">V</button>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground w-7">Rot</span>
                <button onClick={() => onRotateStrokes?.(selectedStrokeIds, 90)} className="w-6 h-6 rounded bg-card/90 border border-border text-foreground text-[9px] font-bold hover:bg-accent/30" title="Rotate 90° CW">↻</button>
                <button onClick={() => onRotateStrokes?.(selectedStrokeIds, -90)} className="w-6 h-6 rounded bg-card/90 border border-border text-foreground text-[9px] font-bold hover:bg-accent/30" title="Rotate 90° CCW">↺</button>
                <input
                  type="number"
                  defaultValue={45}
                  min={-360}
                  max={360}
                  className="w-10 h-6 px-1 text-[9px] rounded bg-card/90 border border-border text-foreground font-mono text-center"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onRotateStrokes?.(selectedStrokeIds, Number((e.target as HTMLInputElement).value) || 0);
                    }
                  }}
                  title="Type angle and press Enter"
                />
              </div>
            </div>
          </>
        );
      })()}
      
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
