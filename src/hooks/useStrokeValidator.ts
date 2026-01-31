import { useMemo } from 'react';
import { StrokePoint, StrokeData } from '@/types/handwriting';

// Line positions as percentages of canvas height (must match FourLineCanvas)
const LINE_CONFIG = {
  ascender: 15,
  xHeight: 40,
  baseline: 70,
  descender: 90,
};

export interface ValidationMetrics {
  baselineConsistency: number; // 0-100, how well strokes align to baseline
  xHeightUniformity: number;   // 0-100, how uniform lowercase height is
  ascenderUsage: number;       // 0-100, how much of ascender zone is used
  descenderUsage: number;      // 0-100, how much of descender zone is used
  verticalCenter: number;      // Percentage position of stroke center
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'baseline' | 'xHeight' | 'ascender' | 'descender' | 'floating';
  severity: 'warning' | 'error';
  message: string;
}

interface UseStrokeValidatorProps {
  strokes: StrokeData[];
  currentStroke: StrokePoint[];
  canvasHeight: number;
}

export function useStrokeValidator({ strokes, currentStroke, canvasHeight }: UseStrokeValidatorProps): ValidationMetrics {
  return useMemo(() => {
    if (canvasHeight === 0) {
      return getEmptyMetrics();
    }

    // Collect all points from strokes and current stroke
    const allPoints: StrokePoint[] = [
      ...strokes.flatMap(s => s.points),
      ...currentStroke,
    ];

    if (allPoints.length === 0) {
      return getEmptyMetrics();
    }

    // Calculate line positions in pixels
    const lines = {
      ascender: (canvasHeight * LINE_CONFIG.ascender) / 100,
      xHeight: (canvasHeight * LINE_CONFIG.xHeight) / 100,
      baseline: (canvasHeight * LINE_CONFIG.baseline) / 100,
      descender: (canvasHeight * LINE_CONFIG.descender) / 100,
    };

    // Get Y bounds of all strokes
    const yValues = allPoints.map(p => p.y);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    // Calculate metrics
    const baselineConsistency = calculateBaselineConsistency(allPoints, lines, canvasHeight);
    const xHeightUniformity = calculateXHeightUniformity(allPoints, lines, canvasHeight);
    const ascenderUsage = calculateZoneUsage(minY, lines.ascender, lines.xHeight);
    const descenderUsage = calculateZoneUsage(maxY, lines.baseline, lines.descender);
    const verticalCenter = ((minY + maxY) / 2 / canvasHeight) * 100;

    // Detect issues
    const issues = detectIssues(allPoints, lines, canvasHeight, baselineConsistency, xHeightUniformity);

    return {
      baselineConsistency,
      xHeightUniformity,
      ascenderUsage,
      descenderUsage,
      verticalCenter,
      issues,
    };
  }, [strokes, currentStroke, canvasHeight]);
}

function getEmptyMetrics(): ValidationMetrics {
  return {
    baselineConsistency: 100,
    xHeightUniformity: 100,
    ascenderUsage: 0,
    descenderUsage: 0,
    verticalCenter: 50,
    issues: [],
  };
}

function calculateBaselineConsistency(
  points: StrokePoint[],
  lines: { baseline: number; xHeight: number },
  canvasHeight: number
): number {
  if (points.length === 0) return 100;

  // Find the lowest points (bottom of strokes) - these should align with baseline
  const bottomPoints = findBottomPoints(points);
  if (bottomPoints.length === 0) return 100;

  // Calculate how close bottom points are to the baseline
  const tolerance = canvasHeight * 0.08; // 8% tolerance
  let alignedCount = 0;

  for (const y of bottomPoints) {
    const distanceToBaseline = Math.abs(y - lines.baseline);
    if (distanceToBaseline <= tolerance) {
      alignedCount++;
    }
  }

  return Math.round((alignedCount / bottomPoints.length) * 100);
}

function calculateXHeightUniformity(
  points: StrokePoint[],
  lines: { xHeight: number; baseline: number },
  canvasHeight: number
): number {
  if (points.length === 0) return 100;

  // Find the topmost points of the main body (ignoring ascenders)
  const topPoints = findTopPoints(points);
  if (topPoints.length === 0) return 100;

  // Filter points that are in the x-height zone (not ascender zone)
  const xHeightZoneTop = lines.xHeight;
  const xHeightPoints = topPoints.filter(y => y >= xHeightZoneTop * 0.8);
  
  if (xHeightPoints.length < 2) return 100;

  // Calculate standard deviation of top points
  const mean = xHeightPoints.reduce((a, b) => a + b, 0) / xHeightPoints.length;
  const variance = xHeightPoints.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0) / xHeightPoints.length;
  const stdDev = Math.sqrt(variance);

  // Convert to uniformity score (lower deviation = higher uniformity)
  const maxAcceptableDeviation = canvasHeight * 0.1; // 10% of canvas height
  const uniformity = Math.max(0, 100 - (stdDev / maxAcceptableDeviation) * 100);

  return Math.round(uniformity);
}

function calculateZoneUsage(pointY: number, zoneStart: number, zoneEnd: number): number {
  if (pointY < zoneStart) {
    // Point is above the zone - calculate how far into it
    const zoneHeight = zoneEnd - zoneStart;
    const penetration = zoneStart - pointY;
    return Math.min(100, Math.round((penetration / zoneHeight) * 100));
  }
  if (pointY > zoneEnd) {
    // Point is below the zone
    const zoneHeight = zoneEnd - zoneStart;
    const penetration = pointY - zoneEnd;
    return Math.min(100, Math.round((penetration / zoneHeight) * 100));
  }
  // Point is within zone
  const zoneHeight = zoneEnd - zoneStart;
  const position = pointY - zoneStart;
  return Math.round((position / zoneHeight) * 100);
}

function findBottomPoints(points: StrokePoint[]): number[] {
  // Group points by X position and find the maximum Y (bottom) for each group
  const gridSize = 10;
  const groups = new Map<number, number>();
  
  for (const p of points) {
    const gridX = Math.floor(p.x / gridSize);
    const currentMax = groups.get(gridX) || 0;
    if (p.y > currentMax) {
      groups.set(gridX, p.y);
    }
  }
  
  return Array.from(groups.values());
}

function findTopPoints(points: StrokePoint[]): number[] {
  // Group points by X position and find the minimum Y (top) for each group
  const gridSize = 10;
  const groups = new Map<number, number>();
  
  for (const p of points) {
    const gridX = Math.floor(p.x / gridSize);
    const currentMin = groups.get(gridX);
    if (currentMin === undefined || p.y < currentMin) {
      groups.set(gridX, p.y);
    }
  }
  
  return Array.from(groups.values());
}

function detectIssues(
  points: StrokePoint[],
  lines: { ascender: number; xHeight: number; baseline: number; descender: number },
  canvasHeight: number,
  baselineConsistency: number,
  xHeightUniformity: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (points.length === 0) return issues;

  const yValues = points.map(p => p.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  // Check if strokes are floating (not touching baseline)
  const baselineTolerance = canvasHeight * 0.12;
  if (maxY < lines.baseline - baselineTolerance) {
    issues.push({
      type: 'floating',
      severity: 'warning',
      message: 'Character is floating above baseline',
    });
  }

  // Check baseline consistency
  if (baselineConsistency < 60) {
    issues.push({
      type: 'baseline',
      severity: baselineConsistency < 40 ? 'error' : 'warning',
      message: 'Inconsistent baseline alignment',
    });
  }

  // Check x-height uniformity
  if (xHeightUniformity < 60) {
    issues.push({
      type: 'xHeight',
      severity: xHeightUniformity < 40 ? 'error' : 'warning',
      message: 'Uneven character height',
    });
  }

  // Check if using too much descender space for non-descender characters
  const descenderUsage = maxY > lines.baseline ? ((maxY - lines.baseline) / (lines.descender - lines.baseline)) * 100 : 0;
  if (descenderUsage > 60) {
    issues.push({
      type: 'descender',
      severity: 'warning',
      message: 'Extends below baseline (descender zone)',
    });
  }

  return issues;
}
