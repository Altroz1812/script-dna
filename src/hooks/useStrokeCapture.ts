import { useState, useCallback, useRef } from 'react';
import { StrokePoint, StrokeData, LiveMetrics, ShapeSuggestion } from '@/types/handwriting';

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

  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const strokeStartTimeRef = useRef<number>(0);

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
      setMetrics({
        slantAngle: 0,
        pressureVariance: 0,
        avgVelocity: 0,
        strokeCount: allStrokes.length,
        totalPoints: 0,
      });
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

  const startStroke = useCallback((x: number, y: number, pressure: number = 0.5) => {
    const time = performance.now();
    strokeStartTimeRef.current = time;
    lastPointRef.current = { x, y, time };
    setIsDrawing(true);
    
    const point: StrokePoint = {
      x,
      y,
      pressure,
      velocity: 0,
      timestamp: time,
    };
    setCurrentStroke([point]);
  }, []);

  const continueStroke = useCallback((x: number, y: number, pressure: number = 0.5) => {
    if (!isDrawing) return;
    
    const time = performance.now();
    const velocity = calculateVelocity(x, y, time);
    lastPointRef.current = { x, y, time };

    const point: StrokePoint = {
      x,
      y,
      pressure,
      velocity,
      timestamp: time,
    };

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
      
      setStrokes(prev => {
        const newStrokes = [...prev, newStroke];
        updateMetrics(newStrokes, []);
        return newStrokes;
      });
    }
    
    setCurrentStroke([]);
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [currentStroke, updateMetrics]);

  const undo = useCallback(() => {
    setStrokes(prev => {
      const newStrokes = prev.slice(0, -1);
      updateMetrics(newStrokes, []);
      return newStrokes;
    });
  }, [updateMetrics]);

  const clear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
    setMetrics({
      slantAngle: 0,
      pressureVariance: 0,
      avgVelocity: 0,
      strokeCount: 0,
      totalPoints: 0,
    });
  }, []);

  const replaceLastStroke = useCallback((newPoints: StrokePoint[]) => {
    setStrokes(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = { ...last, points: newPoints };
      updateMetrics(updated, []);
      return updated;
    });
  }, [updateMetrics]);

  return {
    strokes,
    currentStroke,
    isDrawing,
    metrics,
    startStroke,
    continueStroke,
    endStroke,
    undo,
    clear,
    replaceLastStroke,
  };
}
