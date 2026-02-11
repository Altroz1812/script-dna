import { StrokePoint, ShapeSuggestion } from '@/types/handwriting';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface ShapeCorrectionOverlayProps {
  suggestion: ShapeSuggestion;
  canvasWidth: number;
  canvasHeight: number;
  onAccept: () => void;
  onReject: () => void;
}

function pointsToSvgPath(points: StrokePoint[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  // Close circles and ellipses
  return d;
}

export function ShapeCorrectionOverlay({
  suggestion,
  canvasWidth,
  canvasHeight,
  onAccept,
  onReject,
}: ShapeCorrectionOverlayProps) {
  const path = pointsToSvgPath(suggestion.correctedPoints);

  // Position the toolbar near the centroid of the corrected shape
  const cx = suggestion.correctedPoints.reduce((s, p) => s + p.x, 0) / suggestion.correctedPoints.length;
  const cy = suggestion.correctedPoints.reduce((s, p) => s + p.y, 0) / suggestion.correctedPoints.length;

  // Clamp toolbar position
  const toolbarX = Math.min(Math.max(cx - 80, 8), canvasWidth - 170);
  const toolbarY = Math.min(Math.max(cy + 20, 8), canvasHeight - 50);

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Ghost overlay SVG */}
      <svg
        className="absolute inset-0 w-full h-full animate-in fade-in duration-300"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        preserveAspectRatio="none"
      >
        {/* Glow filter */}
        <defs>
          <filter id="shape-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Corrected shape path */}
        <path
          d={path}
          fill="none"
          stroke="hsl(142, 71%, 45%)"
          strokeWidth="2.5"
          strokeDasharray="8 4"
          filter="url(#shape-glow)"
          opacity="0.85"
        />
      </svg>

      {/* Accept / Reject toolbar */}
      <div
        className="absolute pointer-events-auto flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-card/95 border border-border shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-200"
        style={{ left: toolbarX, top: toolbarY }}
      >
        <span className="text-[10px] text-muted-foreground font-medium mr-1 max-w-[100px] truncate">
          {suggestion.label}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-400/10"
          onClick={onAccept}
        >
          <Check className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
          onClick={onReject}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
