import { useState, useCallback, useRef, useEffect } from 'react';
import { StrokePoint, StrokeData, LiveMetrics, AdvancedCanvasConfig } from '@/types/handwriting';
import { applyPressureCurve } from '@/lib/pressureCurves';

interface PointerEventWithPencil {
  clientX: number;
  clientY: number;
  pressure: number;
  pointerType: string;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
  tangentialPressure?: number;
  getCoalescedEvents?: () => PointerEvent[];
  getPredictedEvents?: () => PointerEvent[];
}

const DEFAULT_CONFIG: AdvancedCanvasConfig = {
  brushWidth: 3,
  penColor: '#3b82f6',
  pressureCurve: 'linear',
  pressureMultiplier: 1.0,
  penAngleLock: false,
  lockedAngle: 75,
  overlay: 'lines',
  slantAngle: 75,
  targetSamplingRate: 120,
  enablePrediction: true,
  enableCoalescing: true,
  smoothingLevel: 0.3,
  bezierFitting: true,
};

export function useAdvancedStrokeCapture(config: Partial<AdvancedCanvasConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    slantAngle: 0,
    pressureVariance: 0,
    avgVelocity: 0,
    strokeCount: 0,
    totalPoints: 0,
    avgTilt: 0,
    avgAzimuth: 0,
    samplingRate: 0,
  });

  const lastPointRef = useRef<{ x: number; y: number; time: number; velocity: number } | null>(null);
  const strokeStartTimeRef = useRef<number>(0);
  const sampleCountRef = useRef<number>(0);
  const sampleTimeRef = useRef<number>(0);
  const undoStackRef = useRef<StrokeData[][]>([]);
  const redoStackRef = useRef<StrokeData[][]>([]);

  // Calculate velocity and acceleration
  const calculateKinematics = useCallback((x: number, y: number, time: number) => {
    if (!lastPointRef.current) {
      return { velocity: 0, acceleration: 0 };
    }
    
    const dx = x - lastPointRef.current.x;
    const dy = y - lastPointRef.current.y;
    const dt = Math.max(time - lastPointRef.current.time, 1); // Avoid division by zero
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const velocity = distance / dt;
    const acceleration = (velocity - (lastPointRef.current.velocity || 0)) / dt;
    
    return { velocity, acceleration };
  }, []);

  // Extract Apple Pencil data from pointer event
  const extractPencilData = useCallback((e: PointerEventWithPencil): Partial<StrokePoint> => {
    const tiltX = e.tiltX ?? 0;
    const tiltY = e.tiltY ?? 0;
    
    // Calculate azimuth and altitude from tilt
    const tiltXRad = (tiltX * Math.PI) / 180;
    const tiltYRad = (tiltY * Math.PI) / 180;
    
    const azimuthAngle = Math.atan2(Math.sin(tiltXRad), Math.sin(tiltYRad));
    const altitudeAngle = Math.acos(Math.sqrt(Math.sin(tiltXRad) ** 2 + Math.sin(tiltYRad) ** 2));
    
    return {
      tiltX,
      tiltY,
      azimuthAngle: isNaN(azimuthAngle) ? 0 : azimuthAngle,
      altitudeAngle: isNaN(altitudeAngle) ? Math.PI / 2 : altitudeAngle,
      twist: e.twist ?? 0,
      tangentialPressure: e.tangentialPressure ?? 0,
      pointerType: e.pointerType as 'pen' | 'touch' | 'mouse',
    };
  }, []);

  // Apply sub-pixel smoothing with Bezier
  const applySmoothing = useCallback((points: StrokePoint[], level: number): StrokePoint[] => {
    if (points.length < 3 || level === 0) return points;
    
    const smoothed: StrokePoint[] = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // Weighted average with neighbors
      const weight = level * 0.3;
      const x = curr.x * (1 - weight * 2) + prev.x * weight + next.x * weight;
      const y = curr.y * (1 - weight * 2) + prev.y * weight + next.y * weight;
      
      smoothed.push({
        ...curr,
        x,
        y,
      });
    }
    
    smoothed.push(points[points.length - 1]);
    return smoothed;
  }, []);

  // Update live metrics
  const updateMetrics = useCallback((allStrokes: StrokeData[], currentPoints: StrokePoint[]) => {
    const allPoints = [...allStrokes.flatMap(s => s.points), ...currentPoints];
    
    if (allPoints.length === 0) {
      setMetrics({
        slantAngle: 0,
        pressureVariance: 0,
        avgVelocity: 0,
        strokeCount: allStrokes.length,
        totalPoints: 0,
        avgTilt: 0,
        avgAzimuth: 0,
        samplingRate: 0,
      });
      return;
    }

    // Calculate slant angle
    let totalAngle = 0;
    let segments = 0;
    for (let i = 1; i < allPoints.length; i++) {
      const dx = allPoints[i].x - allPoints[i - 1].x;
      const dy = allPoints[i].y - allPoints[i - 1].y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        totalAngle += Math.atan2(dy, dx) * (180 / Math.PI);
        segments++;
      }
    }
    const slantAngle = segments > 0 ? totalAngle / segments : 0;

    // Calculate pressure variance
    const pressures = allPoints.map(p => p.pressure);
    const meanPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;
    const variance = pressures.reduce((sum, p) => sum + Math.pow(p - meanPressure, 2), 0) / pressures.length;
    const pressureVariance = Math.sqrt(variance);

    // Calculate averages
    const avgVelocity = allPoints.reduce((sum, p) => sum + p.velocity, 0) / allPoints.length;
    const avgTilt = allPoints.reduce((sum, p) => sum + (p.tiltX || 0), 0) / allPoints.length;
    const avgAzimuth = allPoints.reduce((sum, p) => sum + ((p.azimuthAngle || 0) * 180 / Math.PI), 0) / allPoints.length;

    // Calculate sampling rate
    const now = performance.now();
    const elapsed = now - sampleTimeRef.current;
    const samplingRate = elapsed > 0 ? (sampleCountRef.current / elapsed) * 1000 : 0;

    setMetrics({
      slantAngle: Math.round(slantAngle * 10) / 10,
      pressureVariance: Math.round(pressureVariance * 1000) / 1000,
      avgVelocity: Math.round(avgVelocity * 100) / 100,
      strokeCount: allStrokes.length + (currentPoints.length > 0 ? 1 : 0),
      totalPoints: allPoints.length,
      avgTilt: Math.round(avgTilt * 10) / 10,
      avgAzimuth: Math.round(avgAzimuth * 10) / 10,
      samplingRate: Math.round(samplingRate),
    });
  }, []);

  // Process pointer event into stroke points (handles coalesced + predicted)
  const processPointerEvent = useCallback((
    e: PointerEventWithPencil,
    getPosition: (e: { clientX: number; clientY: number }) => { x: number; y: number },
    addPoint: (point: StrokePoint) => void
  ) => {
    const time = performance.now();
    
    // Process coalesced events (high-frequency intermediate points)
    if (mergedConfig.enableCoalescing && e.getCoalescedEvents) {
      const coalesced = e.getCoalescedEvents();
      for (const coalescedEvent of coalesced) {
        const { x, y } = getPosition(coalescedEvent);
        const { velocity, acceleration } = calculateKinematics(x, y, time);
        const pencilData = extractPencilData(coalescedEvent as PointerEventWithPencil);
        
        const rawPressure = coalescedEvent.pressure || 0.5;
        const mappedPressure = applyPressureCurve(
          rawPressure,
          mergedConfig.pressureCurve,
          mergedConfig.pressureMultiplier
        );
        
        const point: StrokePoint = {
          x,
          y,
          pressure: mappedPressure,
          velocity,
          acceleration,
          timestamp: time,
          isCoalesced: true,
          isPredicted: false,
          ...pencilData,
        };
        
        addPoint(point);
        lastPointRef.current = { x, y, time, velocity };
        sampleCountRef.current++;
      }
    } else {
      // Single point
      const { x, y } = getPosition(e);
      const { velocity, acceleration } = calculateKinematics(x, y, time);
      const pencilData = extractPencilData(e);
      
      const rawPressure = e.pressure || 0.5;
      const mappedPressure = applyPressureCurve(
        rawPressure,
        mergedConfig.pressureCurve,
        mergedConfig.pressureMultiplier
      );
      
      const point: StrokePoint = {
        x,
        y,
        pressure: mappedPressure,
        velocity,
        acceleration,
        timestamp: time,
        isCoalesced: false,
        isPredicted: false,
        ...pencilData,
      };
      
      addPoint(point);
      lastPointRef.current = { x, y, time, velocity };
      sampleCountRef.current++;
    }
    
    // Handle predicted events (for lower latency feel)
    if (mergedConfig.enablePrediction && e.getPredictedEvents) {
      const predicted = e.getPredictedEvents();
      for (const predictedEvent of predicted) {
        const { x, y } = getPosition(predictedEvent);
        const { velocity, acceleration } = calculateKinematics(x, y, time);
        const pencilData = extractPencilData(predictedEvent as PointerEventWithPencil);
        
        const point: StrokePoint = {
          x,
          y,
          pressure: predictedEvent.pressure || 0.5,
          velocity,
          acceleration,
          timestamp: time,
          isCoalesced: false,
          isPredicted: true,
          ...pencilData,
        };
        
        addPoint(point);
      }
    }
  }, [mergedConfig, calculateKinematics, extractPencilData]);

  // Start stroke
  const startStroke = useCallback((x: number, y: number, pressure: number = 0.5, event?: PointerEvent) => {
    const time = performance.now();
    strokeStartTimeRef.current = time;
    sampleCountRef.current = 0;
    sampleTimeRef.current = time;
    lastPointRef.current = { x, y, time, velocity: 0 };
    setIsDrawing(true);
    
    const mappedPressure = applyPressureCurve(
      pressure,
      mergedConfig.pressureCurve,
      mergedConfig.pressureMultiplier
    );
    
    let pencilData: Partial<StrokePoint> = {};
    if (event) {
      pencilData = extractPencilData(event as PointerEventWithPencil);
    }
    
    const point: StrokePoint = {
      x,
      y,
      pressure: mappedPressure,
      velocity: 0,
      acceleration: 0,
      timestamp: time,
      isPredicted: false,
      isCoalesced: false,
      ...pencilData,
    };
    
    setCurrentStroke([point]);
    sampleCountRef.current = 1;
  }, [mergedConfig, extractPencilData]);

  // Continue stroke
  const continueStroke = useCallback((x: number, y: number, pressure: number = 0.5, event?: PointerEvent) => {
    if (!isDrawing) return;
    
    const time = performance.now();
    const { velocity, acceleration } = calculateKinematics(x, y, time);
    
    const mappedPressure = applyPressureCurve(
      pressure,
      mergedConfig.pressureCurve,
      mergedConfig.pressureMultiplier
    );
    
    let pencilData: Partial<StrokePoint> = {};
    if (event) {
      pencilData = extractPencilData(event as PointerEventWithPencil);
    }
    
    lastPointRef.current = { x, y, time, velocity };
    
    const point: StrokePoint = {
      x,
      y,
      pressure: mappedPressure,
      velocity,
      acceleration,
      timestamp: time,
      isPredicted: false,
      isCoalesced: false,
      ...pencilData,
    };

    setCurrentStroke(prev => {
      // Remove any previously predicted points
      const filtered = prev.filter(p => !p.isPredicted);
      const newPoints = [...filtered, point];
      
      // Apply smoothing if enabled
      const smoothed = mergedConfig.smoothingLevel > 0
        ? applySmoothing(newPoints, mergedConfig.smoothingLevel)
        : newPoints;
      
      updateMetrics(strokes, smoothed);
      sampleCountRef.current++;
      return smoothed;
    });
  }, [isDrawing, calculateKinematics, mergedConfig, extractPencilData, applySmoothing, strokes, updateMetrics]);

  // End stroke
  const endStroke = useCallback((color: string, width: number) => {
    if (currentStroke.length > 0) {
      // Remove predicted points and apply final smoothing
      const finalPoints = currentStroke.filter(p => !p.isPredicted);
      const smoothedPoints = mergedConfig.bezierFitting
        ? applySmoothing(finalPoints, mergedConfig.smoothingLevel)
        : finalPoints;
      
      const newStroke: StrokeData = {
        id: crypto.randomUUID(),
        points: smoothedPoints,
        color,
        width,
        startTime: strokeStartTimeRef.current,
        endTime: performance.now(),
      };
      
      // Save to undo stack
      undoStackRef.current.push([...strokes]);
      redoStackRef.current = [];
      
      setStrokes(prev => {
        const newStrokes = [...prev, newStroke];
        updateMetrics(newStrokes, []);
        return newStrokes;
      });
    }
    
    setCurrentStroke([]);
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [currentStroke, mergedConfig, applySmoothing, strokes, updateMetrics]);

  // Undo (stroke-level)
  const undo = useCallback(() => {
    const prevState = undoStackRef.current.pop();
    if (prevState !== undefined) {
      redoStackRef.current.push([...strokes]);
      setStrokes(prevState);
      updateMetrics(prevState, []);
    }
  }, [strokes, updateMetrics]);

  // Redo (stroke-level)
  const redo = useCallback(() => {
    const nextState = redoStackRef.current.pop();
    if (nextState !== undefined) {
      undoStackRef.current.push([...strokes]);
      setStrokes(nextState);
      updateMetrics(nextState, []);
    }
  }, [strokes, updateMetrics]);

  // Clear all
  const clear = useCallback(() => {
    undoStackRef.current.push([...strokes]);
    redoStackRef.current = [];
    setStrokes([]);
    setCurrentStroke([]);
    setMetrics({
      slantAngle: 0,
      pressureVariance: 0,
      avgVelocity: 0,
      strokeCount: 0,
      totalPoints: 0,
      avgTilt: 0,
      avgAzimuth: 0,
      samplingRate: 0,
    });
  }, [strokes]);

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
    clear,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    processPointerEvent,
  };
}
