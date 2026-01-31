import { Settings2, ArrowUpFromLine, ArrowDownFromLine, Space, Type } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface FontMetadata {
  fontName: string;
  ascenderHeight: number;
  descenderDepth: number;
  globalKerning: number;
  lineHeight: number;
  xHeight: number;
}

interface FontMetadataConfigProps {
  metadata: FontMetadata;
  onMetadataChange: (metadata: FontMetadata) => void;
}

export function FontMetadataConfig({ metadata, onMetadataChange }: FontMetadataConfigProps) {
  const handleChange = (key: keyof FontMetadata, value: number | string) => {
    onMetadataChange({ ...metadata, [key]: value });
  };

  /* ===============================
     🔢 METRIC CALCULATIONS
     =============================== */

  const totalHeight = metadata.ascenderHeight + metadata.descenderDepth;

  const ascenderY = 0;
  const xHeightY = (metadata.ascenderHeight - metadata.xHeight) / totalHeight;
  const baselineY = metadata.ascenderHeight / totalHeight;
  const descenderY = 1;

  const toPct = (v: number) => `${v * 100}%`;

  /* ===============================
     🖼 RENDER
     =============================== */

  return (
    <div className="panel-glass p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Settings2 className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Font Metadata</h3>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Font Name */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Type className="w-3 h-3" />
            Font Name
          </Label>
          <Input
            value={metadata.fontName}
            onChange={(e) => handleChange("fontName", e.target.value)}
            placeholder="My Handwriting"
            className="bg-secondary/50 border-border/50"
          />
        </div>

        {/* Ascender */}
        <MetricSlider
          label="Ascender Height"
          icon={<ArrowUpFromLine className="w-3 h-3" />}
          value={metadata.ascenderHeight}
          min={100}
          max={400}
          step={10}
          onChange={(v) => handleChange("ascenderHeight", v)}
          hint="Height of letters like b, d, h"
        />

        {/* Descender */}
        <MetricSlider
          label="Descender Depth"
          icon={<ArrowDownFromLine className="w-3 h-3" />}
          value={metadata.descenderDepth}
          min={100}
          max={300}
          step={10}
          onChange={(v) => handleChange("descenderDepth", v)}
          hint="Depth of letters like g, p, y"
        />

        {/* X-height */}
        <MetricSlider
          label="X-Height"
          icon={<span className="font-mono text-[10px]">x</span>}
          value={metadata.xHeight}
          min={200}
          max={500}
          step={10}
          onChange={(v) => handleChange("xHeight", v)}
          hint="Height of lowercase letters"
        />

        {/* Kerning */}
        <MetricSlider
          label="Global Kerning"
          icon={<Space className="w-3 h-3" />}
          value={metadata.globalKerning}
          min={-50}
          max={100}
          step={5}
          onChange={(v) => handleChange("globalKerning", v)}
          hint="Default letter spacing"
        />

        {/* Line height */}
        <MetricSlider
          label="Line Height"
          value={metadata.lineHeight}
          min={100}
          max={200}
          step={5}
          suffix="%"
          onChange={(v) => handleChange("lineHeight", v)}
        />
      </div>

      {/* ===============================
          👁 LIVE METRICS PREVIEW
          =============================== */}

      <div className="pt-3 border-t border-border/50">
        <div className="text-xs text-muted-foreground mb-2">Metrics Preview</div>

        <div className="relative h-24 bg-secondary/30 rounded-lg overflow-hidden">
          {/* Ascender */}
          <PreviewLine top={toPct(ascenderY)} label="Ascender" className="border-primary/40" />

          {/* X-height */}
          <PreviewLine top={toPct(xHeightY)} label="X-Height" className="border-accent/50" />

          {/* Baseline */}
          <PreviewLine top={toPct(baselineY)} label="Baseline" className="border-foreground/60 border-t-2" />

          {/* Descender */}
          <PreviewLine top={toPct(descenderY)} label="Descender" className="border-destructive/40" />

          {/* Sample text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="font-mono text-foreground/80 transition-all duration-200"
              style={{
                fontSize: `${metadata.xHeight / 12}px`,
                letterSpacing: `${metadata.globalKerning / 10}px`,
                lineHeight: metadata.lineHeight / 100,
              }}
            >
              Abpgy
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===============================
   🔁 REUSABLE COMPONENTS
   =============================== */

function MetricSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  icon,
  hint,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  icon?: React.ReactNode;
  hint?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          {icon}
          {label}
        </Label>
        <span className="font-mono text-sm text-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PreviewLine({ top, label, className }: { top: string; label: string; className?: string }) {
  return (
    <div
      className={`absolute left-0 right-0 border-t border-dashed transition-all duration-200 ${className}`}
      style={{ top }}
    >
      <span className="absolute left-2 -top-2.5 text-[8px] text-muted-foreground">{label}</span>
    </div>
  );
}
