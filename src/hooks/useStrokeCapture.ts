import { useState, useCallback, useRef } from 'react';
import { StrokePoint, StrokeData, LiveMetrics, ShapeSuggestion } from '@/types/handwriting';

const MAX_HISTORY = 50;

export function useStrokeCapture() {
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    slantAngle: 0,
    pressureVariance: 0,
    avgVelocity: 0,
    strokeCount: 0,
    totalPoints: 0,
  });

  // History stack for undo/redo
  const historyRef = useRef<StrokeData[][]>([[]]);
  const historyIndexRef = useRef(0);

  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const strokeStartTimeRef = useRef<number>(0);

  const pushHistory = useCallback((newStrokes: StrokeData[]) => {
    const idx = historyIndexRef.current;
    // Trim any redo history beyond current index
    const trimmed = historyRef.current.slice(0, idx + 1);
    trimmed.push(newStrokes);
    if (trimmed.length > MAX_HISTORY) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
  }, []);

  const calculateVelocity = useCallback((x: number, y: number, time: number): number => {
    if (!lastPointRef.current) return 0;
    const dx = x - lastPointRef.current.x;
    const dy = y - lastPointRef.current.y;
    const dt = time - lastPointRef.current.time;
    if (dt === 0) return 0;
    return Math.sqrt(dx * dx + dy * dy) / dt;
  }, []);

  const calculateSlantAngle = useCallback((points: StrokePoint[]): number => {
    if (points.length < 2) return 0;
    let totalAngle = 0;
    let segments = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        totalAngle += angle;
        segments++;
      }
    }
    return segments > 0 ? totalAngle / segments : 0;
  }, []);

  const calculatePressureVariance = useCallback((points: StrokePoint[]): number => {
    if (points.length < 2) return 0;
    const pressures = points.map(p => p.pressure);
    const mean = pressures.reduce((a, b) => a + b, 0) / pressures.length;
    const variance = pressures.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pressures.length;
    return Math.sqrt(variance);
  }, []);

  const updateMetrics = useCallback((allStrokes: StrokeData[], currentPoints: StrokePoint[]) => {
    const allPoints = [...allStrokes.flatMap(s => s.points), ...currentPoints];
    if (allPoints.length === 0) {
      setMetrics({ slantAngle: 0, pressureVariance: 0, avgVelocity: 0, strokeCount: allStrokes.length, totalPoints: 0 });
      return;
    }
    const slantAngle = calculateSlantAngle(allPoints);
    const pressureVariance = calculatePressureVariance(allPoints);
    const avgVelocity = allPoints.reduce((sum, p) => sum + p.velocity, 0) / allPoints.length;
    setMetrics({
      slantAngle: Math.round(slantAngle * 10) / 10,
      pressureVariance: Math.round(pressureVariance * 1000) / 1000,
      avgVelocity: Math.round(avgVelocity * 100) / 100,
      strokeCount: allStrokes.length + (currentPoints.length > 0 ? 1 : 0),
      totalPoints: allPoints.length,
    });
  }, [calculateSlantAngle, calculatePressureVariance]);

  const applyStrokes = useCallback((newStrokes: StrokeData[], saveHistory = true) => {
    setStrokes(newStrokes);
    updateMetrics(newStrokes, []);
    if (saveHistory) pushHistory(newStrokes);
  }, [updateMetrics, pushHistory]);

  const startStroke = useCallback((x: number, y: number, pressure: number = 0.5) => {
    const time = performance.now();
    strokeStartTimeRef.current = time;
    lastPointRef.current = { x, y, time };
    setIsDrawing(true);
    setCurrentStroke([{ x, y, pressure, velocity: 0, timestamp: time }]);
  }, []);

  const continueStroke = useCallback((x: number, y: number, pressure: number = 0.5) => {
    if (!isDrawing) return;
    const time = performance.now();
    const velocity = calculateVelocity(x, y, time);
    lastPointRef.current = { x, y, time };
    const point: StrokePoint = { x, y, pressure, velocity, timestamp: time };
    setCurrentStroke(prev => {
      const newPoints = [...prev, point];
      updateMetrics(strokes, newPoints);
      return newPoints;
    });
  }, [isDrawing, calculateVelocity, strokes, updateMetrics]);

  const endStroke = useCallback((color: string, width: number) => {
    if (currentStroke.length > 0) {
      const newStroke: StrokeData = {
        id: crypto.randomUUID(),
        points: currentStroke,
        color,
        width,
        startTime: strokeStartTimeRef.current,
        endTime: performance.now(),
      };
      const newStrokes = [...strokes, newStroke];
      applyStrokes(newStrokes);
    }
    setCurrentStroke([]);
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [currentStroke, strokes, applyStrokes]);

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    historyIndexRef.current = idx - 1;
    const prev = historyRef.current[idx - 1];
    setStrokes(prev);
    updateMetrics(prev, []);
  }, [updateMetrics]);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    if (idx >= historyRef.current.length - 1) return;
    historyIndexRef.current = idx + 1;
    const next = historyRef.current[idx + 1];
    setStrokes(next);
    updateMetrics(next, []);
  }, [updateMetrics]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const clear = useCallback(() => {
    applyStrokes([]);
    setCurrentStroke([]);
  }, [applyStrokes]);

  const replaceLastStroke = useCallback((newPoints: StrokePoint[]) => {
    if (strokes.length === 0) return;
    const updated = [...strokes];
    updated[updated.length - 1] = { ...updated[updated.length - 1], points: newPoints };
    applyStrokes(updated);
  }, [strokes, applyStrokes]);

  // Eraser: save snapshot on first erase, then update without pushing history each move
  const eraserSnapshotSavedRef = useRef(false);

  const startErase = useCallback(() => {
    eraserSnapshotSavedRef.current = false;
  }, []);

  const eraseAtPoint = useCallback((x: number, y: number, radius: number) => {
    setStrokes(prev => {
      // Save snapshot before first erase in this gesture
      if (!eraserSnapshotSavedRef.current) {
        pushHistory(prev);
        eraserSnapshotSavedRef.current = true;
      }
      const updated = prev.map(stroke => {
        const remaining = stroke.points.filter(p => {
          const dx = p.x - x;
          const dy = p.y - y;
          return Math.sqrt(dx * dx + dy * dy) >= radius;
        });
        if (remaining.length === stroke.points.length) return stroke;
        if (remaining.length === 0) return null;
        return { ...stroke, points: remaining };
      }).filter(Boolean) as StrokeData[];
      // Update the current history entry to reflect eraser result
      historyRef.current[historyRef.current.length - 1] = updated;
      updateMetrics(updated, []);
      return updated;
    });
  }, [updateMetrics, pushHistory]);

  const endErase = useCallback(() => {
    eraserSnapshotSavedRef.current = false;
  }, []);

  const addStamp = useCallback((points: StrokePoint[], color: string, width: number) => {
    const now = performance.now();
    const newStroke: StrokeData = {
      id: crypto.randomUUID(),
      points,
      color,
      width,
      startTime: now,
      endTime: now,
    };
    applyStrokes([...strokes, newStroke]);
  }, [strokes, applyStrokes]);

  // Select tool: move strokes
  const moveStrokes = useCallback((strokeIds: string[], dx: number, dy: number) => {
    const updated = strokes.map(s => {
      if (!strokeIds.includes(s.id)) return s;
      return {
        ...s,
        points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })),
      };
    });
    applyStrokes(updated);
  }, [strokes, applyStrokes]);

  // Select tool: scale strokes around their centroid
  const scaleStrokes = useCallback((strokeIds: string[], scaleFactor: number) => {
    const updated = strokes.map(s => {
      if (!strokeIds.includes(s.id)) return s;
      const cx = s.points.reduce((sum, p) => sum + p.x, 0) / s.points.length;
      const cy = s.points.reduce((sum, p) => sum + p.y, 0) / s.points.length;
      return {
        ...s,
        points: s.points.map(p => ({
          ...p,
          x: cx + (p.x - cx) * scaleFactor,
          y: cy + (p.y - cy) * scaleFactor,
        })),
      };
    });
    applyStrokes(updated);
  }, [strokes, applyStrokes]);

  // Select tool: change stroke width (thickness)
  const changeStrokeWidth = useCallback((strokeIds: string[], delta: number) => {
    const updated = strokes.map(s => {
      if (!strokeIds.includes(s.id)) return s;
      return { ...s, width: Math.max(1, Math.min(40, s.width + delta)) };
    });
    applyStrokes(updated);
  }, [strokes, applyStrokes]);

  // Select tool: resize strokes within a bounding box transformation
  const resizeStrokes = useCallback((strokeIds: string[], oldBounds: { minX: number; minY: number; maxX: number; maxY: number }, newBounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
    const ow = oldBounds.maxX - oldBounds.minX || 1;
    const oh = oldBounds.maxY - oldBounds.minY || 1;
    const nw = newBounds.maxX - newBounds.minX || 1;
    const nh = newBounds.maxY - newBounds.minY || 1;
    const updated = strokes.map(s => {
      if (!strokeIds.includes(s.id)) return s;
      return {
        ...s,
        points: s.points.map(p => ({
          ...p,
          x: newBounds.minX + ((p.x - oldBounds.minX) / ow) * nw,
          y: newBounds.minY + ((p.y - oldBounds.minY) / oh) * nh,
        })),
      };
    });
    applyStrokes(updated);
  }, [strokes, applyStrokes]);

  // Flip strokes horizontally or vertically around their centroid
  const flipStrokes = useCallback((strokeIds: string[], axis: 'horizontal' | 'vertical') => {
    const selected = strokes.filter(s => strokeIds.includes(s.id));
    const allPts = selected.flatMap(s => s.points);
    if (allPts.length === 0) return;
    const cx = allPts.reduce((s, p) => s + p.x, 0) / allPts.length;
    const cy = allPts.reduce((s, p) => s + p.y, 0) / allPts.length;
    const updated = strokes.map(s => {
      if (!strokeIds.includes(s.id)) return s;
      return {
        ...s,
        points: s.points.map(p => ({
          ...p,
          x: axis === 'horizontal' ? 2 * cx - p.x : p.x,
          y: axis === 'vertical' ? 2 * cy - p.y : p.y,
        })),
      };
    });
    applyStrokes(updated);
  }, [strokes, applyStrokes]);

  // Rotate strokes 90° clockwise around their centroid
  const rotateStrokes = useCallback((strokeIds: string[], angleDeg: number = 90) => {
    const selected = strokes.filter(s => strokeIds.includes(s.id));
    const allPts = selected.flatMap(s => s.points);
    if (allPts.length === 0) return;
    const cx = allPts.reduce((s, p) => s + p.x, 0) / allPts.length;
    const cy = allPts.reduce((s, p) => s + p.y, 0) / allPts.length;
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const updated = strokes.map(s => {
      if (!strokeIds.includes(s.id)) return s;
      return {
        ...s,
        points: s.points.map(p => {
          const dx = p.x - cx;
          const dy = p.y - cy;
          return { ...p, x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        }),
      };
    });
    applyStrokes(updated);
  }, [strokes, applyStrokes]);

  // Flip ALL strokes on canvas
  const flipAll = useCallback((axis: 'horizontal' | 'vertical') => {
    if (strokes.length === 0) return;
    flipStrokes(strokes.map(s => s.id), axis);
  }, [strokes, flipStrokes]);

  // Rotate ALL strokes on canvas
  const rotateAll = useCallback((angleDeg: number = 90) => {
    if (strokes.length === 0) return;
    rotateStrokes(strokes.map(s => s.id), angleDeg);
  }, [strokes, rotateStrokes]);

  // Load external strokes onto canvas (e.g. from saved font library data)
  const loadStrokes = useCallback((newStrokes: StrokeData[]) => {
    applyStrokes(newStrokes);
    setCurrentStroke([]);
  }, [applyStrokes]);

  return {
    strokes,
    currentStroke,
    isDrawing,
    metrics,
    startStroke,
    continueStroke,
    endStroke,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    replaceLastStroke,
    eraseAtPoint,
    startErase,
    endErase,
    addStamp,
    moveStrokes,
    scaleStrokes,
    changeStrokeWidth,
    resizeStrokes,
    flipStrokes,
    rotateStrokes,
    flipAll,
    rotateAll,
    loadStrokes,
  };
}
