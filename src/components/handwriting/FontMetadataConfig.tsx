import { useState } from "react";
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

  return (
    <div className="panel-glass p-4 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Settings2 className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Font Metadata</h3>
      </div>

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

        {/* Ascender Height */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ArrowUpFromLine className="w-3 h-3" />
              Ascender Height
            </Label>
            <span className="font-mono text-sm text-foreground">{metadata.ascenderHeight}</span>
          </div>
          <Slider
            value={[metadata.ascenderHeight]}
            onValueChange={([value]) => handleChange("ascenderHeight", value)}
            min={100}
            max={400}
            step={10}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground">Height of letters like 'b', 'd', 'h' above x-height</p>
        </div>

        {/* Descender Depth */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ArrowDownFromLine className="w-3 h-3" />
              Descender Depth
            </Label>
            <span className="font-mono text-sm text-foreground">{metadata.descenderDepth}</span>
          </div>
          <Slider
            value={[metadata.descenderDepth]}
            onValueChange={([value]) => handleChange("descenderDepth", value)}
            min={100}
            max={300}
            step={10}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground">Depth of letters like 'g', 'p', 'y' below baseline</p>
        </div>

        {/* X-Height */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="font-mono text-[10px]">x</span>
              X-Height
            </Label>
            <span className="font-mono text-sm text-foreground">{metadata.xHeight}</span>
          </div>
          <Slider
            value={[metadata.xHeight]}
            onValueChange={([value]) => handleChange("xHeight", value)}
            min={200}
            max={500}
            step={10}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground">Height of lowercase letters like 'a', 'e', 'o'</p>
        </div>

        {/* Global Kerning */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Space className="w-3 h-3" />
              Global Kerning
            </Label>
            <span className="font-mono text-sm text-foreground">{metadata.globalKerning}</span>
          </div>
          <Slider
            value={[metadata.globalKerning]}
            onValueChange={([value]) => handleChange("globalKerning", value)}
            min={-50}
            max={100}
            step={5}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground">Default spacing between letters (can be negative)</p>
        </div>

        {/* Line Height */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Line Height</Label>
            <span className="font-mono text-sm text-foreground">{metadata.lineHeight}%</span>
          </div>
          <Slider
            value={[metadata.lineHeight]}
            onValueChange={([value]) => handleChange("lineHeight", value)}
            min={100}
            max={200}
            step={5}
            className="w-full"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="pt-3 border-t border-border/50">
        <div className="text-xs text-muted-foreground mb-2">Metrics Preview</div>
        <div className="relative h-20 bg-secondary/30 rounded-lg overflow-hidden">
          {/* Ascender line */}
          <div className="absolute left-0 right-0 border-t border-dashed border-primary/30" style={{ top: "10%" }}>
            <span className="absolute left-2 -top-2.5 text-[8px] text-primary/60">Ascender</span>
          </div>
          {/* X-height line */}
          <div className="absolute left-0 right-0 border-t border-accent/50" style={{ top: "35%" }}>
            <span className="absolute left-2 -top-2.5 text-[8px] text-accent/60">X-Height</span>
          </div>
          {/* Baseline */}
          <div className="absolute left-0 right-0 border-t-2 border-foreground/50" style={{ top: "65%" }}>
            <span className="absolute left-2 -top-2.5 text-[8px] text-foreground/60">Baseline</span>
          </div>
          {/* Descender line */}
          <div className="absolute left-0 right-0 border-t border-dashed border-destructive/30" style={{ top: "85%" }}>
            <span className="absolute left-2 -top-2.5 text-[8px] text-destructive/60">Descender</span>
          </div>
          {/* Sample text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-2xl text-foreground/80">Abpgy</span>
          </div>
        </div>
      </div>
    </div>
  );
}
