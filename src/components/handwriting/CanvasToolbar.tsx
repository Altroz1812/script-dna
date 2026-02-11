import { useState } from 'react';
import { Undo2, Redo2, Trash2, Grid3X3, AlignJustify, X, Pen, Eraser, Circle, Minus, MoveUpRight, Ellipsis, Square, Triangle, MousePointer2, FlipHorizontal2, FlipVertical2, RotateCw, CircleDot } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToolbarConfig, OverlayType, CanvasTool } from '@/types/handwriting';
import { cn } from '@/lib/utils';

interface CanvasToolbarProps {
  config: ToolbarConfig;
  onConfigChange: (config: Partial<ToolbarConfig>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onFlipAll?: (axis: 'horizontal' | 'vertical') => void;
  onRotateAll?: (angleDeg?: number) => void;
}

const COLORS = [
  '#3b82f6', '#14b8a6', '#8b5cf6', '#f97316',
  '#ef4444', '#22c55e', '#f8fafc', '#64748b',
];

const TOOLS: { value: CanvasTool; icon: React.ReactNode; label: string }[] = [
  { value: 'pen', icon: <Pen className="w-4 h-4" />, label: 'Pen' },
  { value: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
  { value: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select & Move' },
];

const STAMP_TOOLS: { value: CanvasTool; icon: React.ReactNode; label: string }[] = [
  { value: 'stamp_circle', icon: <Circle className="w-3.5 h-3.5" />, label: 'Circle' },
  { value: 'stamp_semicircle', icon: <CircleDot className="w-3.5 h-3.5" />, label: 'Semi-Circle' },
  { value: 'stamp_ellipse', icon: <Ellipsis className="w-3.5 h-3.5" />, label: 'Ellipse' },
  { value: 'stamp_rectangle', icon: <Square className="w-3.5 h-3.5" />, label: 'Rectangle' },
  { value: 'stamp_triangle', icon: <Triangle className="w-3.5 h-3.5" />, label: 'Triangle' },
  { value: 'stamp_line', icon: <Minus className="w-3.5 h-3.5" />, label: 'Line' },
  { value: 'stamp_arc', icon: <MoveUpRight className="w-3.5 h-3.5" />, label: 'Arc' },
];

function CustomRotationInput({ onRotate }: { onRotate: (deg: number) => void }) {
  const [angle, setAngle] = useState('45');
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Custom Rotation</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          className="w-16 px-2 py-1 text-sm rounded-md bg-secondary border border-border text-foreground font-mono"
          min={-360}
          max={360}
        />
        <span className="text-xs text-muted-foreground">°</span>
        <button
          onClick={() => onRotate(Number(angle) || 0)}
          className="px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
        >
          Apply
        </button>
      </div>
      <div className="flex gap-1">
        {[15, 30, 45, 90, 180].map((deg) => (
          <button
            key={deg}
            onClick={() => onRotate(deg)}
            className="px-2 py-1 text-[10px] rounded bg-secondary/80 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            {deg}°
          </button>
        ))}
      </div>
    </div>
  );
}

export function CanvasToolbar({
  config,
  onConfigChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  onFlipAll,
  onRotateAll,
}: CanvasToolbarProps) {
  const overlayOptions: { value: OverlayType; icon: React.ReactNode; label: string }[] = [
    { value: 'none', icon: <X className="w-4 h-4" />, label: 'No Overlay' },
    { value: 'grid', icon: <Grid3X3 className="w-4 h-4" />, label: 'Grid' },
    { value: 'lines', icon: <AlignJustify className="w-4 h-4" />, label: 'Lines' },
  ];

  const isStampActive = config.activeTool.startsWith('stamp_');

  return (
    <div className="flex items-center gap-2 p-3 panel-glass rounded-xl flex-wrap">
      {/* Drawing Tools */}
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.value}
            onClick={() => onConfigChange({ activeTool: tool.value })}
            className={cn(
              "toolbar-button",
              config.activeTool === tool.value && "active"
            )}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Shape Stamps */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "toolbar-button flex items-center gap-1",
              isStampActive && "active"
            )}
            title="Shape Stamps"
          >
            <Circle className="w-4 h-4" />
            <span className="text-[10px] font-medium">Shapes</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-popover border-border">
          <div className="grid grid-cols-2 gap-1.5">
            {STAMP_TOOLS.map((tool) => (
              <button
                key={tool.value}
                onClick={() => onConfigChange({ activeTool: tool.value })}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  "hover:bg-accent/50",
                  config.activeTool === tool.value
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground"
                )}
              >
                {tool.icon}
                {tool.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-px h-6 bg-border" />

      {/* Brush Size */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/50 rounded-lg">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {config.activeTool === 'eraser' ? 'Eraser' : 'Size'}
        </span>
        <Slider
          value={[config.brushWidth]}
          onValueChange={([value]) => onConfigChange({ brushWidth: value })}
          min={1}
          max={config.activeTool === 'eraser' ? 40 : 20}
          step={1}
          className="w-24"
        />
        <span className="font-mono text-sm text-foreground w-6">{config.brushWidth}</span>
      </div>

      {/* Pen Color (hidden for eraser) */}
      {config.activeTool !== 'eraser' && (
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
      )}

      <div className="w-px h-6 bg-border" />

      {/* Flip & Rotate */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onFlipAll?.('horizontal')}
          className="toolbar-button"
          title="Flip Horizontal"
        >
          <FlipHorizontal2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onFlipAll?.('vertical')}
          className="toolbar-button"
          title="Flip Vertical"
        >
          <FlipVertical2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onRotateAll?.(90)}
          className="toolbar-button"
          title="Rotate 90°"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button className="toolbar-button flex items-center gap-1" title="Custom Rotation">
              <RotateCw className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">°</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 bg-popover border-border">
            <CustomRotationInput onRotate={(deg) => onRotateAll?.(deg)} />
          </PopoverContent>
        </Popover>
      </div>

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
