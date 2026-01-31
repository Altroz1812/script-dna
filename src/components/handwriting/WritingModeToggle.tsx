import { WritingMode, WritingAssistanceConfig } from '@/types/writingAssistance';
import { cn } from '@/lib/utils';
import { Wand2, Fingerprint, Sliders } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface WritingModeToggleProps {
  mode: WritingMode;
  config: WritingAssistanceConfig;
  onModeChange: (mode: WritingMode) => void;
  onConfigChange: (config: Partial<WritingAssistanceConfig>) => void;
  className?: string;
}

export function WritingModeToggle({
  mode,
  config,
  onModeChange,
  onConfigChange,
  className,
}: WritingModeToggleProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Mode Toggle Pills */}
      <div className="flex items-center bg-secondary/50 rounded-lg p-1">
        <button
          onClick={() => onModeChange('originality')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            mode === 'originality'
              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Fingerprint className="w-3.5 h-3.5" />
          <span>Original</span>
        </button>
        <button
          onClick={() => onModeChange('perfection')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            mode === 'perfection'
              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>Perfect</span>
        </button>
      </div>

      {/* Settings Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Sliders className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <div className="font-medium text-sm">Assistance Settings</div>
            
            {/* Mode Description */}
            <div className="p-2 rounded-md bg-secondary/50 text-xs text-muted-foreground">
              {mode === 'perfection' ? (
                <p><strong className="text-primary">Perfection Mode:</strong> Live magnetic snapping guides your strokes toward ideal curves. Best for font creation.</p>
              ) : (
                <p><strong className="text-purple-400">Originality Mode:</strong> Your natural style is preserved. Visual hints appear without affecting your strokes.</p>
              )}
            </div>

            {/* Snap Strength (Perfection Mode only) */}
            {mode === 'perfection' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Snap Strength</Label>
                  <span className="text-xs text-muted-foreground">
                    {(config.snapStrength * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[config.snapStrength]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={([value]) => onConfigChange({ snapStrength: value })}
                />
              </div>
            )}

            {/* Ghost Opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Ghost Opacity</Label>
                <span className="text-xs text-muted-foreground">
                  {(config.ghostOpacity * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[config.ghostOpacity]}
                min={0}
                max={1}
                step={0.1}
                onValueChange={([value]) => onConfigChange({ ghostOpacity: value })}
              />
            </div>

            {/* Hint Sensitivity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Detection Sensitivity</Label>
                <span className="text-xs text-muted-foreground">
                  {(config.hintSensitivity * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[config.hintSensitivity]}
                min={0}
                max={1}
                step={0.1}
                onValueChange={([value]) => onConfigChange({ hintSensitivity: value })}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
