// Writing Assistance Types

export type WritingMode = 'perfection' | 'originality';

export interface StrokeIssue {
  type: 'flattened_curve' | 'over_tight_loop' | 'broken_circle' | 'angular_deviation' | 'inconsistent_pressure' | 'shaky_line';
  severity: 'low' | 'medium' | 'high';
  startIndex: number;
  endIndex: number;
  description: string;
  suggestedFix?: { x: number; y: number }[];
}

export interface CurveAnalysis {
  curvature: number;        // Average curvature (0 = straight, higher = more curved)
  smoothness: number;       // 0-1 (1 = perfectly smooth)
  consistency: number;      // 0-1 (1 = consistent stroke width/pressure)
  angularDeviation: number; // Degrees from expected angle
}

export interface WritingAssistanceState {
  mode: WritingMode;
  isEnabled: boolean;
  showGhostOverlay: boolean;
  showCorrectionHints: boolean;
  magneticSnapping: boolean;
  issues: StrokeIssue[];
  idealPath: { x: number; y: number }[];
  curveAnalysis: CurveAnalysis | null;
}

export interface IdealPathPoint {
  x: number;
  y: number;
  pressure: number;
  expectedCurvature: number;
}

export interface WritingAssistanceConfig {
  mode: WritingMode;
  isEnabled: boolean;       // Global toggle
  snapStrength: number;     // 0-1 for perfection mode
  ghostOpacity: number;     // 0-1 for overlay visibility
  hintSensitivity: number;  // 0-1 for detection threshold
}
