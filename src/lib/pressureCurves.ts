import { PressureCurveType } from '@/types/handwriting';

/**
 * Pressure Sensitivity Curves
 * Transform raw pressure input (0-1) to styled output (0-1)
 */

// Linear: Direct 1:1 mapping
export const linearCurve = (pressure: number): number => {
  return Math.max(0, Math.min(1, pressure));
};

// Calligraphic: Sharp response at light/heavy ends, flat in middle
// Creates dramatic thick-thin transitions like a broad-edge nib
export const calligraphicCurve = (pressure: number): number => {
  const p = Math.max(0, Math.min(1, pressure));
  // S-curve with steeper ends
  if (p < 0.3) {
    return p * 0.5; // Light strokes stay very thin
  } else if (p > 0.7) {
    return 0.5 + (p - 0.7) * 1.67; // Heavy strokes get much thicker
  }
  return 0.15 + (p - 0.3) * 0.875; // Middle range is gradual
};

// Elastic: Soft start, exponential growth - mimics flexible brush
export const elasticCurve = (pressure: number): number => {
  const p = Math.max(0, Math.min(1, pressure));
  // Quadratic ease-in
  return p * p;
};

// Soft: Reduced sensitivity, good for trembling hands
export const softCurve = (pressure: number): number => {
  const p = Math.max(0, Math.min(1, pressure));
  // Square root for softer response
  return Math.sqrt(p);
};

// Firm: Requires more pressure for thick lines
export const firmCurve = (pressure: number): number => {
  const p = Math.max(0, Math.min(1, pressure));
  // Cubic curve - requires firm pressure
  return p * p * p;
};

// Get pressure curve function by type
export const getPressureCurve = (type: PressureCurveType): ((pressure: number) => number) => {
  switch (type) {
    case 'linear':
      return linearCurve;
    case 'calligraphic':
      return calligraphicCurve;
    case 'elastic':
      return elasticCurve;
    case 'soft':
      return softCurve;
    case 'firm':
      return firmCurve;
    default:
      return linearCurve;
  }
};

// Apply pressure curve with multiplier
export const applyPressureCurve = (
  pressure: number,
  curveType: PressureCurveType,
  multiplier: number = 1.0
): number => {
  const curve = getPressureCurve(curveType);
  const curved = curve(pressure);
  return Math.max(0, Math.min(1, curved * multiplier));
};

// Generate curve preview data (for UI visualization)
export const generateCurvePreview = (
  curveType: PressureCurveType,
  points: number = 50
): { input: number; output: number }[] => {
  const curve = getPressureCurve(curveType);
  const data: { input: number; output: number }[] = [];
  
  for (let i = 0; i <= points; i++) {
    const input = i / points;
    data.push({
      input,
      output: curve(input),
    });
  }
  
  return data;
};

// Curve descriptions for UI
export const PRESSURE_CURVE_DESCRIPTIONS: Record<PressureCurveType, { name: string; description: string }> = {
  linear: {
    name: 'Linear',
    description: 'Direct 1:1 pressure mapping. Natural feel.',
  },
  calligraphic: {
    name: 'Calligraphic',
    description: 'Dramatic thick-thin. Mimics broad-edge nibs.',
  },
  elastic: {
    name: 'Elastic',
    description: 'Soft start, builds pressure. Like a flexible brush.',
  },
  soft: {
    name: 'Soft',
    description: 'Reduced sensitivity. Good for steady lines.',
  },
  firm: {
    name: 'Firm',
    description: 'Requires firm pressure for thick strokes.',
  },
};
