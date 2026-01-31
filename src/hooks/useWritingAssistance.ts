import { useState, useCallback, useMemo } from 'react';
import { StrokePoint } from '@/types/handwriting';
import { 
  WritingMode, 
  StrokeIssue, 
  CurveAnalysis, 
  WritingAssistanceState,
  WritingAssistanceConfig 
} from '@/types/writingAssistance';

interface UseWritingAssistanceProps {
  currentStroke: StrokePoint[];
  targetCharacter: string | null;
  canvasHeight: number;
}

// Character ideal paths (simplified templates)
const IDEAL_CURVES: Record<string, { hasLoop: boolean; hasCurve: boolean; isCircular: boolean }> = {
  'o': { hasLoop: true, hasCurve: true, isCircular: true },
  'O': { hasLoop: true, hasCurve: true, isCircular: true },
  'a': { hasLoop: true, hasCurve: true, isCircular: false },
  'e': { hasLoop: true, hasCurve: true, isCircular: false },
  'c': { hasLoop: false, hasCurve: true, isCircular: false },
  'C': { hasLoop: false, hasCurve: true, isCircular: false },
  'd': { hasLoop: true, hasCurve: true, isCircular: false },
  'g': { hasLoop: true, hasCurve: true, isCircular: false },
  'p': { hasLoop: true, hasCurve: true, isCircular: false },
  'q': { hasLoop: true, hasCurve: true, isCircular: false },
  'b': { hasLoop: true, hasCurve: true, isCircular: false },
  '0': { hasLoop: true, hasCurve: true, isCircular: true },
  '6': { hasLoop: true, hasCurve: true, isCircular: false },
  '8': { hasLoop: true, hasCurve: true, isCircular: false },
  '9': { hasLoop: true, hasCurve: true, isCircular: false },
};

export function useWritingAssistance({ 
  currentStroke, 
  targetCharacter,
  canvasHeight 
}: UseWritingAssistanceProps) {
  const [config, setConfig] = useState<WritingAssistanceConfig>({
    mode: 'originality',
    isEnabled: true,
    snapStrength: 0.5,
    ghostOpacity: 0.3,
    hintSensitivity: 0.5,
  });

  // Calculate curvature at a point (using 3-point method)
  const calculateCurvature = useCallback((p1: StrokePoint, p2: StrokePoint, p3: StrokePoint): number => {
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;
    
    const cross = dx1 * dy2 - dy1 * dx2;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    if (len1 < 0.001 || len2 < 0.001) return 0;
    
    return (2 * cross) / (len1 * len2 * (len1 + len2));
  }, []);

  // Analyze stroke for issues
  const analyzeStroke = useCallback((points: StrokePoint[]): StrokeIssue[] => {
    if (points.length < 5) return [];
    
    const issues: StrokeIssue[] = [];
    const charInfo = targetCharacter ? IDEAL_CURVES[targetCharacter] : null;
    
    // Calculate curvatures along the stroke
    const curvatures: number[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      curvatures.push(Math.abs(calculateCurvature(points[i - 1], points[i], points[i + 1])));
    }
    
    // Detect flattened curves (expected curve but low curvature)
    if (charInfo?.hasCurve) {
      const avgCurvature = curvatures.reduce((a, b) => a + b, 0) / curvatures.length;
      if (avgCurvature < 0.005 && points.length > 10) {
        // Find the flattest segment
        let flatStart = 0;
        let flatEnd = 0;
        let minCurv = Infinity;
        
        for (let i = 0; i < curvatures.length - 5; i++) {
          const segmentCurv = curvatures.slice(i, i + 5).reduce((a, b) => a + b, 0) / 5;
          if (segmentCurv < minCurv) {
            minCurv = segmentCurv;
            flatStart = i;
            flatEnd = i + 5;
          }
        }
        
        issues.push({
          type: 'flattened_curve',
          severity: avgCurvature < 0.002 ? 'high' : 'medium',
          startIndex: flatStart + 1,
          endIndex: Math.min(flatEnd + 1, points.length - 1),
          description: 'Curve appears flattened - add more arc',
        });
      }
    }
    
    // Detect over-tight loops
    if (charInfo?.hasLoop) {
      for (let i = 2; i < curvatures.length; i++) {
        if (curvatures[i] > 0.15) {
          issues.push({
            type: 'over_tight_loop',
            severity: curvatures[i] > 0.25 ? 'high' : 'medium',
            startIndex: i,
            endIndex: Math.min(i + 3, points.length - 1),
            description: 'Loop is too tight - widen the curve',
          });
          break; // Only report first occurrence
        }
      }
    }
    
    // Detect broken circles (for o, O, 0)
    if (charInfo?.isCircular && points.length > 15) {
      const startPoint = points[0];
      const endPoint = points[points.length - 1];
      const distance = Math.sqrt(
        Math.pow(endPoint.x - startPoint.x, 2) + 
        Math.pow(endPoint.y - startPoint.y, 2)
      );
      
      // Calculate expected size based on stroke extent
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const extent = Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys)
      );
      
      if (distance > extent * 0.2) {
        issues.push({
          type: 'broken_circle',
          severity: distance > extent * 0.4 ? 'high' : 'medium',
          startIndex: points.length - 5,
          endIndex: points.length - 1,
          description: 'Circle not closed - connect start and end',
          suggestedFix: [{ x: startPoint.x, y: startPoint.y }],
        });
      }
    }
    
    // Detect angular deviations (sudden direction changes)
    for (let i = 1; i < curvatures.length - 1; i++) {
      const curvChange = Math.abs(curvatures[i] - curvatures[i - 1]);
      if (curvChange > 0.08 && curvatures[i] > 0.02) {
        issues.push({
          type: 'angular_deviation',
          severity: curvChange > 0.15 ? 'high' : 'low',
          startIndex: i,
          endIndex: i + 2,
          description: 'Sudden angle change - smooth the transition',
        });
      }
    }
    
    // Detect shaky lines (high frequency oscillation)
    if (points.length > 10) {
      let oscillations = 0;
      for (let i = 2; i < curvatures.length; i++) {
        if ((curvatures[i] - curvatures[i - 1]) * (curvatures[i - 1] - curvatures[i - 2]) < 0) {
          oscillations++;
        }
      }
      
      const oscillationRate = oscillations / curvatures.length;
      if (oscillationRate > 0.6) {
        issues.push({
          type: 'shaky_line',
          severity: oscillationRate > 0.8 ? 'high' : 'medium',
          startIndex: 0,
          endIndex: points.length - 1,
          description: 'Line appears shaky - try slower, steadier strokes',
        });
      }
    }
    
    return issues;
  }, [calculateCurvature, targetCharacter]);

  // Calculate curve analysis
  const curveAnalysis = useMemo((): CurveAnalysis | null => {
    if (currentStroke.length < 5) return null;
    
    const curvatures: number[] = [];
    for (let i = 1; i < currentStroke.length - 1; i++) {
      curvatures.push(Math.abs(calculateCurvature(
        currentStroke[i - 1], 
        currentStroke[i], 
        currentStroke[i + 1]
      )));
    }
    
    const avgCurvature = curvatures.reduce((a, b) => a + b, 0) / curvatures.length;
    
    // Calculate smoothness (inverse of curvature variance)
    const curvVariance = curvatures.reduce((acc, c) => acc + Math.pow(c - avgCurvature, 2), 0) / curvatures.length;
    const smoothness = Math.max(0, 1 - Math.min(1, curvVariance * 100));
    
    // Calculate pressure consistency
    const pressures = currentStroke.map(p => p.pressure);
    const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;
    const pressureVariance = pressures.reduce((acc, p) => acc + Math.pow(p - avgPressure, 2), 0) / pressures.length;
    const consistency = Math.max(0, 1 - Math.min(1, pressureVariance * 10));
    
    // Calculate angular deviation from vertical
    const startPoint = currentStroke[0];
    const endPoint = currentStroke[currentStroke.length - 1];
    const angle = Math.atan2(endPoint.x - startPoint.x, endPoint.y - startPoint.y) * (180 / Math.PI);
    
    return {
      curvature: avgCurvature * 1000, // Scale for readability
      smoothness,
      consistency,
      angularDeviation: Math.abs(angle),
    };
  }, [currentStroke, calculateCurvature]);

  // Get detected issues
  const issues = useMemo(() => {
    if (!config.isEnabled) return [];
    return analyzeStroke(currentStroke);
  }, [currentStroke, analyzeStroke, config.isEnabled]);

  // Apply magnetic snapping (for perfection mode)
  const applyMagneticSnap = useCallback((point: StrokePoint): StrokePoint => {
    if (config.mode !== 'perfection' || currentStroke.length < 3) return point;
    
    // Simple smoothing snap - average with recent points
    const recentPoints = currentStroke.slice(-3);
    const avgX = recentPoints.reduce((a, p) => a + p.x, 0) / recentPoints.length;
    const avgY = recentPoints.reduce((a, p) => a + p.y, 0) / recentPoints.length;
    
    const strength = config.snapStrength;
    return {
      ...point,
      x: point.x * (1 - strength * 0.3) + avgX * strength * 0.3,
      y: point.y * (1 - strength * 0.3) + avgY * strength * 0.3,
    };
  }, [config.mode, config.snapStrength, currentStroke]);

  // Toggle mode
  const setMode = useCallback((mode: WritingMode) => {
    setConfig(prev => ({
      ...prev,
      mode,
      magneticSnapping: mode === 'perfection',
    }));
  }, []);

  // Toggle enabled state
  const setEnabled = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, isEnabled: enabled }));
  }, []);

  // Update config
  const updateConfig = useCallback((updates: Partial<WritingAssistanceConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const state: WritingAssistanceState = {
    mode: config.mode,
    isEnabled: true,
    showGhostOverlay: true,
    showCorrectionHints: config.mode === 'originality',
    magneticSnapping: config.mode === 'perfection',
    issues,
    idealPath: [],
    curveAnalysis,
  };

  return {
    state,
    config,
    setMode,
    setEnabled,
    updateConfig,
    applyMagneticSnap,
    issues,
    curveAnalysis,
  };
}
