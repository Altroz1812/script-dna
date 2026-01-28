import { Undo2, Redo2, Trash2, Grid3X3, AlignJustify, X, Palette } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToolbarConfig, OverlayType } from '@/types/handwriting';
import { cn } from '@/lib/utils';

interface CanvasToolbarProps {
  config: ToolbarConfig;
  onConfigChange: (config: Partial<ToolbarConfig>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const COLORS = [
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#ef4444', // Red
  '#22c55e', // Green
  '#f8fafc', // White
  '#64748b', // Slate
];

export function CanvasToolbar({
  config,
  onConfigChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
}: CanvasToolbarProps) {
  const overlayOptions: { value: OverlayType; icon: React.ReactNode; label: string }[] = [
    { value: 'none', icon: <X className="w-4 h-4" />, label: 'No Overlay' },
    { value: 'grid', icon: <Grid3X3 className="w-4 h-4" />, label: 'Grid' },
    { value: 'lines', icon: <AlignJustify className="w-4 h-4" />, label: 'Lines' },
  ];

  return (
    <div className="flex items-center gap-2 p-3 panel-glass rounded-xl">
      {/* Brush Size */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/50 rounded-lg">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</span>
        <Slider
          value={[config.brushWidth]}
          onValueChange={([value]) => onConfigChange({ brushWidth: value })}
          min={1}
          max={20}
          step={1}
          className="w-24"
        />
        <span className="font-mono text-sm text-foreground w-6">{config.brushWidth}</span>
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
        {overlayOptions.map((option) => (
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
    </div>
  );
}
