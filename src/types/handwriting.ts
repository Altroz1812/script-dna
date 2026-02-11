// Enhanced Stroke Point with Apple Pencil DNA
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  velocity: number;
  timestamp: number;
  // Apple Pencil Extended Data
  tiltX?: number;           // Tilt angle X (-90 to 90 degrees)
  tiltY?: number;           // Tilt angle Y (-90 to 90 degrees)
  azimuthAngle?: number;    // Angle in the XY plane (0 to 2π radians)
  altitudeAngle?: number;   // Angle from the surface (0 to π/2 radians)
  acceleration?: number;    // Rate of velocity change
  twist?: number;           // Rotation of the stylus (0 to 2π radians)
  tangentialPressure?: number; // Barrel pressure for supporting styli
  // Input metadata
  pointerType?: 'pen' | 'touch' | 'mouse';
  isPredicted?: boolean;    // Whether this is a predicted touch
  isCoalesced?: boolean;    // Whether this is from coalesced events
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
  // Extended metrics
  avgTilt?: number;
  avgAzimuth?: number;
  samplingRate?: number;
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

// Smart Overlay Types
export type OverlayType = 'none' | 'grid' | 'lines' | 'ruled' | 'fourline' | 'slant';

// Pressure Sensitivity Curve Types
export type PressureCurveType = 'linear' | 'calligraphic' | 'elastic' | 'soft' | 'firm';

// Admin Control Configurations
export interface ToolbarConfig {
  brushWidth: number;
  penColor: string;
  overlay: OverlayType;
}

export interface AdvancedCanvasConfig {
  // Brush Settings
  brushWidth: number;
  penColor: string;
  
  // Pressure Settings
  pressureCurve: PressureCurveType;
  pressureMultiplier: number;  // 0.1 to 3.0
  
  // Angle Settings
  penAngleLock: boolean;
  lockedAngle: number;         // Degrees (0-180)
  
  // Overlay Settings
  overlay: OverlayType;
  slantAngle: number;          // For slant-aligned grid
  
  // Sampling Settings
  targetSamplingRate: number;  // 60, 120, 240 Hz
  enablePrediction: boolean;
  enableCoalescing: boolean;
  
  // Smoothing Settings
  smoothingLevel: number;      // 0-1 (0 = raw, 1 = heavy smoothing)
  bezierFitting: boolean;
}

export interface ShapeSuggestion {
  type: 'circle' | 'ellipse' | 'semi_circle' | 'arc' | 'straight_line' | 'slant_line';
  confidence: number;
  correctedPoints: StrokePoint[];
  originalStrokeId: string;
  label: string;
}
