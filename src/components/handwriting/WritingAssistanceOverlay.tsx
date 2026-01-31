import { useMemo } from 'react';
import { StrokePoint } from '@/types/handwriting';
import { StrokeIssue, WritingMode, CurveAnalysis } from '@/types/writingAssistance';
import { cn } from '@/lib/utils';
import { AlertTriangle, Target, Zap, Circle, TrendingUp } from 'lucide-react';

interface WritingAssistanceOverlayProps {
  issues: StrokeIssue[];
  currentStroke: StrokePoint[];
  mode: WritingMode;
  curveAnalysis: CurveAnalysis | null;
  canvasWidth: number;
  canvasHeight: number;
  ghostOpacity?: number;
}

const ISSUE_ICONS: Record<StrokeIssue['type'], React.ReactNode> = {
  flattened_curve: <TrendingUp className="w-3 h-3" />,
  over_tight_loop: <Circle className="w-3 h-3" />,
  broken_circle: <Circle className="w-3 h-3" />,
  angular_deviation: <Zap className="w-3 h-3" />,
  inconsistent_pressure: <Target className="w-3 h-3" />,
  shaky_line: <AlertTriangle className="w-3 h-3" />,
};

const ISSUE_COLORS: Record<StrokeIssue['severity'], string> = {
  low: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/40',
  medium: 'text-orange-400 bg-orange-500/20 border-orange-500/40',
  high: 'text-red-400 bg-red-500/20 border-red-500/40',
};

export function WritingAssistanceOverlay({
  issues,
  currentStroke,
  mode,
  curveAnalysis,
  canvasWidth,
  canvasHeight,
  ghostOpacity = 0.3,
}: WritingAssistanceOverlayProps) {
  // Generate SVG path for issue highlights
  const issueHighlights = useMemo(() => {
    if (currentStroke.length < 3 || issues.length === 0) return null;

    return issues.map((issue, idx) => {
      const startIdx = Math.max(0, issue.startIndex);
      const endIdx = Math.min(currentStroke.length - 1, issue.endIndex);
      
      if (startIdx >= currentStroke.length || endIdx < 0) return null;
      
      const issuePoints = currentStroke.slice(startIdx, endIdx + 1);
      if (issuePoints.length < 2) return null;

      // Calculate center point for hint display
      const centerX = issuePoints.reduce((a, p) => a + p.x, 0) / issuePoints.length;
      const centerY = issuePoints.reduce((a, p) => a + p.y, 0) / issuePoints.length;

      // Generate path
      let path = `M ${issuePoints[0].x} ${issuePoints[0].y}`;
      for (let i = 1; i < issuePoints.length; i++) {
        path += ` L ${issuePoints[i].x} ${issuePoints[i].y}`;
      }

      const glowColor = issue.severity === 'high' 
        ? 'rgba(239, 68, 68, 0.6)' 
        : issue.severity === 'medium'
          ? 'rgba(249, 115, 22, 0.5)'
          : 'rgba(234, 179, 8, 0.4)';

      return (
        <g key={`issue-${idx}`}>
          {/* Glow effect under the stroke */}
          <path
            d={path}
            fill="none"
            stroke={glowColor}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'blur(4px)' }}
          />
          
          {/* Hint arrow/indicator */}
          {mode === 'originality' && (
            <g transform={`translate(${centerX}, ${centerY - 20})`}>
              <circle r="8" fill={glowColor} />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
              >
                !
              </text>
            </g>
          )}

          {/* Suggested fix path (if available) */}
          {issue.suggestedFix && issue.suggestedFix.length > 0 && (
            <path
              d={`M ${issuePoints[issuePoints.length - 1].x} ${issuePoints[issuePoints.length - 1].y} L ${issue.suggestedFix[0].x} ${issue.suggestedFix[0].y}`}
              fill="none"
              stroke="rgba(34, 197, 94, 0.6)"
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
          )}
        </g>
      );
    });
  }, [issues, currentStroke, mode]);

  // Generate ideal path ghost overlay (simplified circular guide for o/O/0)
  const ghostPath = useMemo(() => {
    if (mode !== 'perfection' || currentStroke.length < 5) return null;
    
    // Create smoothed version of current stroke as "ideal" reference
    const smoothedPoints: { x: number; y: number }[] = [];
    const windowSize = 5;
    
    for (let i = 0; i < currentStroke.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(currentStroke.length, i + Math.ceil(windowSize / 2));
      const window = currentStroke.slice(start, end);
      
      const avgX = window.reduce((a, p) => a + p.x, 0) / window.length;
      const avgY = window.reduce((a, p) => a + p.y, 0) / window.length;
      smoothedPoints.push({ x: avgX, y: avgY });
    }
    
    if (smoothedPoints.length < 2) return null;
    
    let path = `M ${smoothedPoints[0].x} ${smoothedPoints[0].y}`;
    for (let i = 1; i < smoothedPoints.length; i++) {
      const prev = smoothedPoints[i - 1];
      const curr = smoothedPoints[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    }
    
    return (
      <path
        d={path}
        fill="none"
        stroke={`rgba(59, 130, 246, ${ghostOpacity})`}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'blur(2px)' }}
      />
    );
  }, [currentStroke, mode, ghostOpacity]);

  if (issues.length === 0 && !ghostPath) return null;

  return (
    <>
      {/* SVG Overlay for visual hints */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={canvasWidth}
        height={canvasHeight}
        style={{ overflow: 'visible' }}
      >
        {ghostPath}
        {issueHighlights}
      </svg>

      {/* Issue Pills */}
      {issues.length > 0 && (
        <div className="absolute bottom-16 left-3 right-3 flex flex-wrap gap-2">
          {issues.slice(0, 3).map((issue, idx) => (
            <div
              key={`pill-${idx}`}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium animate-in fade-in slide-in-from-bottom-2",
                ISSUE_COLORS[issue.severity]
              )}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {ISSUE_ICONS[issue.type]}
              <span>{issue.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Real-time Curve Analysis (Perfection Mode) */}
      {mode === 'perfection' && curveAnalysis && (
        <div className="absolute top-16 right-3 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 p-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Target className="w-3 h-3" />
            <span>CURVE ANALYSIS</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Smoothness</span>
              <span className={cn(
                curveAnalysis.smoothness > 0.7 ? 'text-green-400' : 
                curveAnalysis.smoothness > 0.4 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {(curveAnalysis.smoothness * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Consistency</span>
              <span className={cn(
                curveAnalysis.consistency > 0.7 ? 'text-green-400' : 
                curveAnalysis.consistency > 0.4 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {(curveAnalysis.consistency * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Curvature</span>
              <span className="text-primary">{curveAnalysis.curvature.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
