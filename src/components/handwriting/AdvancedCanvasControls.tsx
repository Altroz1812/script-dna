import { useState } from 'react';
import { 
  Undo2, Redo2, Trash2, Grid3X3, AlignJustify, X, 
  Ruler, SlidersHorizontal, Pencil, Gauge, Settings2,
  ChevronDown, RotateCcw
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  Collapsible, CollapsibleContent, CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { AdvancedCanvasConfig, OverlayType, PressureCurveType } from '@/types/handwriting';
import { PRESSURE_CURVE_DESCRIPTIONS, generateCurvePreview } from '@/lib/pressureCurves';
import { cn } from '@/lib/utils';

interface AdvancedCanvasControlsProps {
  config: AdvancedCanvasConfig;
  onConfigChange: (config: Partial<AdvancedCanvasConfig>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  samplingRate?: number;
}

const COLORS = [
  '#3b82f6', '#14b8a6', '#8b5cf6', '#f97316',
  '#ef4444', '#22c55e', '#f8fafc', '#64748b',
];

const OVERLAY_OPTIONS: { value: OverlayType; icon: React.ReactNode; label: string }[] = [
  { value: 'none', icon: <X className="w-4 h-4" />, label: 'No Overlay' },
  { value: 'ruled', icon: <AlignJustify className="w-4 h-4" />, label: 'Ruled Lines' },
  { value: 'grid', icon: <Grid3X3 className="w-4 h-4" />, label: 'Grid' },
  { value: 'fourline', icon: <Ruler className="w-4 h-4" />, label: '4-Line Handwriting' },
  { value: 'slant', icon: <SlidersHorizontal className="w-4 h-4" />, label: 'Slant-Aligned' },
];

// Mini pressure curve visualization
function PressureCurvePreview({ curveType }: { curveType: PressureCurveType }) {
  const data = generateCurvePreview(curveType, 20);
  const width = 60;
  const height = 30;
  
  const pathD = data.map((point, i) => {
    const x = (point.input * width);
    const y = height - (point.output * height);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="opacity-70">
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AdvancedCanvasControls({
  config,
  onConfigChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  samplingRate = 0,
}: AdvancedCanvasControlsProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  return (
    <div className="space-y-2">
      {/* Main Toolbar */}
      <div className="flex items-center gap-2 p-3 panel-glass rounded-xl flex-wrap">
        {/* Brush Size */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/50 rounded-lg">
          <Pencil className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[config.brushWidth]}
            onValueChange={([value]) => onConfigChange({ brushWidth: value })}
            min={1}
            max={20}
            step={1}
            className="w-20"
          />
          <span className="font-mono text-sm text-foreground w-5">{config.brushWidth}</span>
        </div>

        {/* Pen Color */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="toolbar-button glow-effect">
              <div 
                className="w-5 h-5 rounded-full border-2 border-border"
                style={{ backgroundColor: config.penColor }}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-popover border-border">
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onConfigChange({ penColor: color })}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                    config.penColor === color ? "border-primary ring-2 ring-primary/30" : "border-border/50"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-6 bg-border" />

        {/* Overlay Options */}
        <div className="flex items-center gap-1">
          {OVERLAY_OPTIONS.slice(0, 3).map((option) => (
            <button
              key={option.value}
              onClick={() => onConfigChange({ overlay: option.value })}
              className={cn(
                "toolbar-button",
                config.overlay === option.value && "active"
              )}
              title={option.label}
            >
              {option.icon}
            </button>
          ))}
          
          {/* More overlays dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <button 
                className={cn(
                  "toolbar-button",
                  ['fourline', 'slant'].includes(config.overlay) && "active"
                )}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2 bg-popover border-border">
              {OVERLAY_OPTIONS.slice(3).map((option) => (
                <button
                  key={option.value}
                  onClick={() => onConfigChange({ overlay: option.value })}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                    "hover:bg-secondary/50 transition-colors",
                    config.overlay === option.value && "bg-primary/20 text-primary"
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Undo/Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={cn("toolbar-button", !canUndo && "opacity-50 cursor-not-allowed")}
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={cn("toolbar-button", !canRedo && "opacity-50 cursor-not-allowed")}
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Clear */}
        <button
          onClick={onClear}
          className="toolbar-button hover:bg-destructive/20 hover:text-destructive"
          title="Clear Canvas"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {/* Sampling Rate Indicator */}
        <div className="flex items-center gap-2 px-2 py-1 bg-secondary/30 rounded-md">
          <Gauge className="w-3.5 h-3.5 text-accent" />
          <span className="font-mono text-xs text-muted-foreground">
            {samplingRate}Hz
          </span>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className={cn(
            "toolbar-button",
            isAdvancedOpen && "active"
          )}
          title="Advanced Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Advanced Controls Panel */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleContent>
          <div className="panel-glass p-4 rounded-xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
              <Settings2 className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Enterprise Admin Controls
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Pressure Sensitivity */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pressure Curve
                </label>
                <Select
                  value={config.pressureCurve}
                  onValueChange={(value) => onConfigChange({ pressureCurve: value as PressureCurveType })}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRESSURE_CURVE_DESCRIPTIONS) as PressureCurveType[]).map((curve) => (
                      <SelectItem key={curve} value={curve}>
                        <div className="flex items-center gap-2">
                          <PressureCurvePreview curveType={curve} />
                          <div>
                            <div className="font-medium">{PRESSURE_CURVE_DESCRIPTIONS[curve].name}</div>
                            <div className="text-xs text-muted-foreground">
                              {PRESSURE_CURVE_DESCRIPTIONS[curve].description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pressure Multiplier */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pressure Sensitivity
                </label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[config.pressureMultiplier * 100]}
                    onValueChange={([value]) => onConfigChange({ pressureMultiplier: value / 100 })}
                    min={10}
                    max={300}
                    step={10}
                    className="flex-1"
                  />
                  <span className="font-mono text-sm w-12 text-right">
                    {Math.round(config.pressureMultiplier * 100)}%
                  </span>
                </div>
              </div>

              {/* Smoothing Level */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Stroke Smoothing
                </label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[config.smoothingLevel * 100]}
                    onValueChange={([value]) => onConfigChange({ smoothingLevel: value / 100 })}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="font-mono text-sm w-12 text-right">
                    {Math.round(config.smoothingLevel * 100)}%
                  </span>
                </div>
              </div>

              {/* Pen Angle Lock */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pen Angle Lock
                  </label>
                  <Switch
                    checked={config.penAngleLock}
                    onCheckedChange={(checked) => onConfigChange({ penAngleLock: checked })}
                  />
                </div>
                {config.penAngleLock && (
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[config.lockedAngle]}
                      onValueChange={([value]) => onConfigChange({ lockedAngle: value })}
                      min={0}
                      max={180}
                      step={5}
                      className="flex-1"
                    />
                    <span className="font-mono text-sm w-12 text-right">
                      {config.lockedAngle}°
                    </span>
                  </div>
                )}
              </div>

              {/* Slant Angle (for slant overlay) */}
              {config.overlay === 'slant' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Slant Grid Angle
                  </label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[config.slantAngle]}
                      onValueChange={([value]) => onConfigChange({ slantAngle: value })}
                      min={45}
                      max={90}
                      step={5}
                      className="flex-1"
                    />
                    <span className="font-mono text-sm w-12 text-right">
                      {config.slantAngle}°
                    </span>
                  </div>
                </div>
              )}

              {/* Sampling Options */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Input Processing
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Coalesced Events</span>
                    <Switch
                      checked={config.enableCoalescing}
                      onCheckedChange={(checked) => onConfigChange({ enableCoalescing: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Predictive Touch</span>
                    <Switch
                      checked={config.enablePrediction}
                      onCheckedChange={(checked) => onConfigChange({ enablePrediction: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Bézier Fitting</span>
                    <Switch
                      checked={config.bezierFitting}
                      onCheckedChange={(checked) => onConfigChange({ bezierFitting: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Reset to Defaults */}
            <div className="pt-2 border-t border-border/50 flex justify-end">
              <button
                onClick={() => onConfigChange({
                  pressureCurve: 'linear',
                  pressureMultiplier: 1.0,
                  smoothingLevel: 0.3,
                  penAngleLock: false,
                  lockedAngle: 75,
                  slantAngle: 75,
                  enableCoalescing: true,
                  enablePrediction: true,
                  bezierFitting: true,
                })}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Defaults
              </button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
