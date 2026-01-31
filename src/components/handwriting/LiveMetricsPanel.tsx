import { Activity, Compass, Waves, Zap, Hash, Gauge, RotateCcw, Target } from 'lucide-react';
import { LiveMetrics } from '@/types/handwriting';

interface LiveMetricsPanelProps {
  metrics: LiveMetrics;
}

export function LiveMetricsPanel({ metrics }: LiveMetricsPanelProps) {
  const primaryMetrics = [
    {
      icon: Compass,
      label: 'Mean Slant Angle',
      value: `${metrics.slantAngle > 0 ? '+' : ''}${metrics.slantAngle}°`,
      description: metrics.slantAngle > 0 ? 'Right-leaning' : metrics.slantAngle < 0 ? 'Left-leaning' : 'Vertical',
    },
    {
      icon: Waves,
      label: 'Pressure Variance',
      value: metrics.pressureVariance.toFixed(3),
      description: metrics.pressureVariance > 0.2 ? 'High variation' : metrics.pressureVariance > 0.1 ? 'Moderate' : 'Consistent',
    },
    {
      icon: Zap,
      label: 'Avg Velocity',
      value: `${metrics.avgVelocity.toFixed(1)} px/ms`,
      description: metrics.avgVelocity > 2 ? 'Fast writing' : metrics.avgVelocity > 0.5 ? 'Moderate pace' : 'Careful strokes',
    },
    {
      icon: Hash,
      label: 'Stroke Count',
      value: metrics.strokeCount.toString(),
      description: `${metrics.totalPoints} data points`,
    },
  ];

  const pencilMetrics = [
    {
      icon: RotateCcw,
      label: 'Avg Tilt',
      value: `${metrics.avgTilt?.toFixed(1) || 0}°`,
    },
    {
      icon: Target,
      label: 'Azimuth',
      value: `${metrics.avgAzimuth?.toFixed(1) || 0}°`,
    },
    {
      icon: Gauge,
      label: 'Sample Rate',
      value: `${metrics.samplingRate || 0}Hz`,
    },
  ];

  return (
    <div className="panel-metrics p-4 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Live Metrics</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">Recording</span>
        </div>
      </div>

      <div className="space-y-4">
        {primaryMetrics.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <item.icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">{item.label}</span>
            </div>
            <div className="metric-value">{item.value}</div>
            <div className="text-xs text-muted-foreground">{item.description}</div>
          </div>
        ))}
      </div>

      {/* Apple Pencil Extended Metrics */}
      <div className="pt-3 border-t border-border/50">
        <div className="text-[10px] font-medium text-accent uppercase tracking-wider mb-2">
          Pencil Physics
        </div>
        <div className="grid grid-cols-3 gap-2">
          {pencilMetrics.map((item) => (
            <div key={item.label} className="text-center p-2 bg-secondary/30 rounded-lg">
              <item.icon className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
              <div className="font-mono text-sm font-bold text-foreground">{item.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Indicator */}
      <div className="pt-4 border-t border-border/50">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Slant Visualization
        </div>
        <div className="relative h-12 bg-secondary/30 rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-0.5 h-8 bg-primary rounded-full transition-transform duration-200"
              style={{ transform: `rotate(${metrics.slantAngle}deg)` }}
            />
          </div>
          <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2 text-[10px] text-muted-foreground font-mono">
            <span>-45°</span>
            <span>0°</span>
            <span>+45°</span>
          </div>
        </div>
      </div>
    </div>
  );
}
