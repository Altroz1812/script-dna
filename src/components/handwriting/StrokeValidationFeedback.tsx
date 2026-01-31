import { CheckCircle2, AlertTriangle, XCircle, Ruler, AlignVerticalJustifyCenter, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { ValidationMetrics, ValidationIssue } from '@/hooks/useStrokeValidator';
import { cn } from '@/lib/utils';

interface StrokeValidationFeedbackProps {
  metrics: ValidationMetrics;
  hasStrokes: boolean;
}

export function StrokeValidationFeedback({ metrics, hasStrokes }: StrokeValidationFeedbackProps) {
  if (!hasStrokes) {
    return (
      <div className="p-4 bg-card/50 rounded-xl border border-border/50">
        <div className="text-center text-muted-foreground text-sm">
          Start writing to see real-time validation
        </div>
      </div>
    );
  }

  const baselineStatus = getStatus(metrics.baselineConsistency);
  const xHeightStatus = getStatus(metrics.xHeightUniformity);

  return (
    <div className="space-y-3">
      {/* Main Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={Ruler}
          label="Baseline"
          value={metrics.baselineConsistency}
          status={baselineStatus}
          description="Alignment to baseline"
        />
        <MetricCard
          icon={AlignVerticalJustifyCenter}
          label="X-Height"
          value={metrics.xHeightUniformity}
          status={xHeightStatus}
          description="Height consistency"
        />
      </div>

      {/* Zone Usage */}
      <div className="p-3 bg-card/50 rounded-xl border border-border/50">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Zone Usage
        </div>
        <div className="space-y-2">
          <ZoneBar 
            icon={ArrowUpToLine}
            label="Ascender"
            value={metrics.ascenderUsage}
            color="hsl(var(--primary))"
          />
          <ZoneBar 
            icon={ArrowDownToLine}
            label="Descender"
            value={metrics.descenderUsage}
            color="hsl(var(--destructive))"
          />
        </div>
      </div>

      {/* Issues */}
      {metrics.issues.length > 0 && (
        <div className="space-y-2">
          {metrics.issues.map((issue, index) => (
            <IssueAlert key={index} issue={issue} />
          ))}
        </div>
      )}

      {/* All Good */}
      {metrics.issues.length === 0 && metrics.baselineConsistency >= 70 && metrics.xHeightUniformity >= 70 && (
        <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span className="text-sm text-success font-medium">Great consistency!</span>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  status: 'good' | 'warning' | 'error';
  description: string;
}

function MetricCard({ icon: Icon, label, value, status, description }: MetricCardProps) {
  const statusColors = {
    good: 'text-success border-success/30 bg-success/10',
    warning: 'text-warning border-warning/30 bg-warning/10',
    error: 'text-destructive border-destructive/30 bg-destructive/10',
  };

  const StatusIcon = status === 'good' ? CheckCircle2 : status === 'warning' ? AlertTriangle : XCircle;

  return (
    <div className={cn('p-3 rounded-xl border', statusColors[status])}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        <StatusIcon className="w-3.5 h-3.5" />
      </div>
      <div className="text-2xl font-bold font-mono">{value}%</div>
      <div className="text-xs opacity-70">{description}</div>
    </div>
  );
}

interface ZoneBarProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}

function ZoneBar({ icon: Icon, label, value, color }: ZoneBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground w-16">{label}</span>
      <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-200"
          style={{ 
            width: `${Math.min(100, value)}%`,
            backgroundColor: color,
            opacity: value > 0 ? 1 : 0.3,
          }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

interface IssueAlertProps {
  issue: ValidationIssue;
}

function IssueAlert({ issue }: IssueAlertProps) {
  const isError = issue.severity === 'error';
  
  return (
    <div className={cn(
      'flex items-center gap-2 p-2.5 rounded-lg text-sm',
      isError 
        ? 'bg-destructive/10 border border-destructive/30 text-destructive' 
        : 'bg-warning/10 border border-warning/30 text-warning'
    )}>
      {isError ? (
        <XCircle className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      )}
      <span className="font-medium">{issue.message}</span>
    </div>
  );
}

function getStatus(value: number): 'good' | 'warning' | 'error' {
  if (value >= 70) return 'good';
  if (value >= 40) return 'warning';
  return 'error';
}
