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

  /* =====================================================
     🔒 METRIC SAFETY (VERY IMPORTANT)
     ===================================================== */

  const ascender = metadata.ascenderHeight;
  const descender = metadata.descenderDepth;

  // x-height can NEVER be greater than ascender
  const safeXHeight = Math.min(metadata.xHeight, ascender);

  // total height must never be zero
  const totalHeight = Math.max(ascender + descender, 1);

  /* =====================================================
     📐 METRIC → PREVIEW COORDINATES
     ===================================================== */

  const ascenderY = 0;
  const xHeightY = (ascender - safeXHeight) / totalHeight;
  const baselineY = ascender / totalHeight;
  const descenderY = 1;

  const toPct = (v: number) => `${v * 100}%`;

  /* =====================================================
     🖼 UI
     ===================================================== */

  return (
    <div className="panel-glass p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Settings2 className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Font Metadata</h3>
      </div>

      {/* ================= CONTROLS ================= */}

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
            className="bg-secondary/50 border-border/50"
          />
        </div>

        {/* Ascender */}
        <MetricSlider
          label="Ascender Height"
          icon={<ArrowUpFromLine className="w-3 h-3" />}
          value={ascender}
          min={150}
          max={500}
          step={10}
          onChange={(v) => handleChange("ascenderHeight", v)}
          hint="Letters like b, d, h"
        />

        {/* Descender */}
        <MetricSlider
          label="Descender Depth"
          icon={<ArrowDownFromLine className="w-3 h-3" />}
          value={descender}
          min={100}
          max={400}
          step={10}
          onChange={(v) => handleChange("descenderDepth", v)}
          hint="Letters like g, p, y"
        />

        {/* X-height (DYNAMIC MAX 🔥) */}
        <MetricSlider
          label="X-Height"
          icon={<span className="font-mono text-[10px]">x</span>}
          value={safeXHeight}
          min={80}
          max={ascender} // 🔥 CRITICAL FIX
          step={10}
          onChange={(v) => handleChange("xHeight", v)}
          hint="Lowercase height (must be ≤ ascender)"
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
          hint="Letter spacing"
        />

        {/* Line Height */}
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

      {/* ================= PREVIEW ================= */}

      <div className="pt-3 border-t border-border/50">
        <div className="text-xs text-muted-foreground mb-2">Metrics Preview</div>

        <div className="relative h-24 bg-secondary/30 rounded-lg overflow-hidden">
          <PreviewLine top={toPct(ascenderY)} label="Ascender" color="border-primary/40" />
          <PreviewLine top={toPct(xHeightY)} label="X-Height" color="border-accent/50" />
          <PreviewLine top={toPct(baselineY)} label="Baseline" color="border-foreground/70" thick />
          <PreviewLine top={toPct(descenderY)} label="Descender" color="border-destructive/40" />

          {/* Sample Text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="font-mono text-foreground/80 transition-all duration-200"
              style={{
                fontSize: `${safeXHeight / 12}px`,
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

/* =====================================================
   🔁 REUSABLE COMPONENTS
   ===================================================== */

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
        <span className="font-mono text-sm">
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PreviewLine({ top, label, color, thick }: { top: string; label: string; color: string; thick?: boolean }) {
  return (
    <div
      className={`absolute left-0 right-0 ${
        thick ? "border-t-2" : "border-t border-dashed"
      } ${color} transition-all duration-200`}
      style={{ top }}
    >
      <span className="absolute left-2 -top-2.5 text-[8px] text-muted-foreground">{label}</span>
    </div>
  );
}
