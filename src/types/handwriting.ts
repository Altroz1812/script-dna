export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  velocity: number;
  timestamp: number;
}

export interface StrokeData {
  id: string;
  points: StrokePoint[];
  color: string;
  width: number;
  startTime: number;
  endTime: number;
}

export interface LiveMetrics {
  slantAngle: number;
  pressureVariance: number;
  avgVelocity: number;
  strokeCount: number;
  totalPoints: number;
}

export interface FontCharacter {
  id: string;
  character: string;
  displayName?: string;
  vectorPaths: string[];
  normalizedBezier: object[];
  meanSlantAngle: number;
  pressureVariance: number;
  strokeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredRule {
  id: string;
  ruleName: string;
  description: string;
  patternType: string;
  detectedValue: number;
  toleranceMin: number;
  toleranceMax: number;
  impactWeight: number;
  status: 'pending' | 'approved' | 'rejected';
  metadata: object;
  createdAt: string;
}

export type OverlayType = 'none' | 'grid' | 'lines';

export interface ToolbarConfig {
  brushWidth: number;
  penColor: string;
  overlay: OverlayType;
}
