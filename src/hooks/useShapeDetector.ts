import { useCallback } from 'react';
import { StrokePoint, ShapeSuggestion } from '@/types/handwriting';

const MIN_POINTS = 6;
const MIN_CONFIDENCE = 0.45;

// Snap angles in degrees
const SNAP_ANGLES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -15, -30, -45, -60, -75, -90, -105, -120, -135, -150, -165, -180];
const SNAP_TOLERANCE = 7; // degrees

function snapAngle(angleDeg: number): number {
  for (const snap of SNAP_ANGLES) {
    if (Math.abs(angleDeg - snap) <= SNAP_TOLERANCE) return snap;
  }
  return angleDeg;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function strokeLength(points: StrokePoint[]) {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += distance(points[i - 1], points[i]);
  return len;
}

function centroid(points: StrokePoint[]) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x: cx, y: cy };
}

function avgPressure(points: StrokePoint[]) {
  return points.reduce((s, p) => s + p.pressure, 0) / points.length;
}

function generateCirclePoints(cx: number, cy: number, r: number, n: number, template: StrokePoint[]): StrokePoint[] {
  const p = avgPressure(template);
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      pressure: p,
      velocity: template[Math.min(i, template.length - 1)]?.velocity ?? 0,
      timestamp: template[Math.min(i, template.length - 1)]?.timestamp ?? Date.now(),
    };
  });
}

function generateEllipsePoints(cx: number, cy: number, rx: number, ry: number, n: number, template: StrokePoint[]): StrokePoint[] {
  const p = avgPressure(template);
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
      pressure: p,
      velocity: template[Math.min(i, template.length - 1)]?.velocity ?? 0,
      timestamp: template[Math.min(i, template.length - 1)]?.timestamp ?? Date.now(),
    };
  });
}

function generateLinePoints(start: { x: number; y: number }, end: { x: number; y: number }, n: number, template: StrokePoint[]): StrokePoint[] {
  const p = avgPressure(template);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      pressure: p,
      velocity: template[Math.min(i, template.length - 1)]?.velocity ?? 0,
      timestamp: template[Math.min(i, template.length - 1)]?.timestamp ?? Date.now(),
    };
  });
}

function generateArcPoints(cx: number, cy: number, r: number, startAngle: number, endAngle: number, n: number, template: StrokePoint[]): StrokePoint[] {
  const p = avgPressure(template);
  const sweep = endAngle - startAngle;
  return Array.from({ length: n }, (_, i) => {
    const angle = startAngle + (sweep * i) / (n - 1);
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      pressure: p,
      velocity: template[Math.min(i, template.length - 1)]?.velocity ?? 0,
      timestamp: template[Math.min(i, template.length - 1)]?.timestamp ?? Date.now(),
    };
  });
}

function detectCircle(points: StrokePoint[]): ShapeSuggestion | null {
  const first = points[0];
  const last = points[points.length - 1];
  const closureGap = distance(first, last);
  const len = strokeLength(points);

  // Must be closed-ish
  if (closureGap / len > 0.25) return null;

  const c = centroid(points);
  const radii = points.map(p => distance(p, c));
  const avgR = radii.reduce((a, b) => a + b, 0) / radii.length;
  if (avgR < 5) return null;

  const variance = radii.reduce((s, r) => s + ((r - avgR) / avgR) ** 2, 0) / radii.length;
  const confidence = Math.max(0, 1 - variance * 5);

  if (confidence < MIN_CONFIDENCE) return null;

  // Check if it's more of an ellipse
  const xRadii = points.map(p => Math.abs(p.x - c.x));
  const yRadii = points.map(p => Math.abs(p.y - c.y));
  const avgRx = xRadii.reduce((a, b) => a + b, 0) / xRadii.length;
  const avgRy = yRadii.reduce((a, b) => a + b, 0) / yRadii.length;
  const ratio = Math.min(avgRx, avgRy) / Math.max(avgRx, avgRy);

  if (ratio < 0.75) {
    // Ellipse
    const corrected = generateEllipsePoints(c.x, c.y, avgRx * 1.27, avgRy * 1.27, points.length, points);
    return {
      type: 'ellipse',
      confidence: confidence * 0.95,
      correctedPoints: corrected,
      originalStrokeId: '',
      label: `Ellipse detected (${Math.round(confidence * 95)}%)`,
    };
  }

  const corrected = generateCirclePoints(c.x, c.y, avgR, points.length, points);
  return {
    type: 'circle',
    confidence,
    correctedPoints: corrected,
    originalStrokeId: '',
    label: `Circle detected (${Math.round(confidence * 100)}%)`,
  };
}

function detectLine(points: StrokePoint[]): ShapeSuggestion | null {
  const first = points[0];
  const last = points[points.length - 1];
  const lineLen = distance(first, last);
  if (lineLen < 15) return null;

  // Max perpendicular deviation
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  let maxDev = 0;
  for (const p of points) {
    const dev = Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / lineLen;
    maxDev = Math.max(maxDev, dev);
  }

  const deviation = maxDev / lineLen;
  const confidence = Math.max(0, 1 - deviation * 4);

  if (confidence < MIN_CONFIDENCE) return null;

  const rawAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  const snappedAngle = snapAngle(rawAngle);
  const snappedRad = (snappedAngle * Math.PI) / 180;
  const isSlant = Math.abs(snappedAngle) > 10 && Math.abs(snappedAngle) < 80;

  // Generate line using snapped angle
  const snappedEnd = {
    x: first.x + lineLen * Math.cos(snappedRad),
    y: first.y + lineLen * Math.sin(snappedRad),
  };

  const corrected = generateLinePoints(first, snappedEnd, points.length, points);
  return {
    type: isSlant ? 'slant_line' : 'straight_line',
    confidence,
    correctedPoints: corrected,
    originalStrokeId: '',
    label: `${isSlant ? 'Slant' : 'Straight'} line ${snappedAngle}° (${Math.round(confidence * 100)}%)`,
  };
}

function detectArc(points: StrokePoint[]): ShapeSuggestion | null {
  const first = points[0];
  const last = points[points.length - 1];
  const chordLen = distance(first, last);
  const len = strokeLength(points);

  // Arc should be open (not closed) but curved
  if (chordLen / len > 0.95 || chordLen / len < 0.3) return null;

  const c = centroid(points);
  const radii = points.map(p => distance(p, c));
  const avgR = radii.reduce((a, b) => a + b, 0) / radii.length;
  if (avgR < 5) return null;

  const variance = radii.reduce((s, r) => s + ((r - avgR) / avgR) ** 2, 0) / radii.length;
  const curvatureConsistency = Math.max(0, 1 - variance * 6);

  if (curvatureConsistency < MIN_CONFIDENCE) return null;

  // Determine arc angles
  const startAngle = Math.atan2(first.y - c.y, first.x - c.x);
  const endAngle = Math.atan2(last.y - c.y, last.x - c.x);

  // Check if it's roughly a semi-circle (sweep ~π)
  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  const isSemiCircle = Math.abs(sweep - Math.PI) < 0.5;

  const corrected = generateArcPoints(c.x, c.y, avgR, startAngle, endAngle, points.length, points);
  return {
    type: isSemiCircle ? 'semi_circle' : 'arc',
    confidence: curvatureConsistency,
    correctedPoints: corrected,
    originalStrokeId: '',
    label: `${isSemiCircle ? 'Semi-circle' : 'Arc'} detected (${Math.round(curvatureConsistency * 100)}%)`,
  };
}

export function useShapeDetector() {
  const detectShape = useCallback((points: StrokePoint[], strokeId: string): ShapeSuggestion | null => {
    if (points.length < MIN_POINTS) return null;

    // Priority order: circle/ellipse > arc/semi-circle > line
    const circle = detectCircle(points);
    if (circle) {
      circle.originalStrokeId = strokeId;
      return circle;
    }

    const arc = detectArc(points);
    if (arc) {
      arc.originalStrokeId = strokeId;
      return arc;
    }

    const line = detectLine(points);
    if (line) {
      line.originalStrokeId = strokeId;
      return line;
    }

    return null;
  }, []);

  return { detectShape };
}
