import { useRef, useEffect } from 'react';

// Default line positions (must match FourLineCanvas defaults)
const DEFAULT_LINE_CONFIG = {
  ascender: 12.5,
  xHeight: 37.5,
  baseline: 62.5,
  descender: 87.5,
};

interface CursiveOverlayProps {
  text: string;
  fontFamily: string;
  canvasWidth: number;
  canvasHeight: number;
  opacity?: number;
  color?: string;
  lineConfig?: { ascender: number; xHeight: number; baseline: number; descender: number };
}

export function CursiveOverlay({
  text,
  fontFamily,
  canvasWidth,
  canvasHeight,
  opacity = 0.2,
  color = '#94a3b8',
  lineConfig = DEFAULT_LINE_CONFIG,
}: CursiveOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Encourage kerning/ligatures when supported by the browser
    try {
      (ctx as any).fontKerning = 'normal';
    } catch {}

    const baselineY = canvasHeight * lineConfig.baseline / 100;
    const xHeightY = canvasHeight * lineConfig.xHeight / 100;
    const ascenderY = canvasHeight * lineConfig.ascender / 100;
    const descenderY = canvasHeight * lineConfig.descender / 100;

    const xHeightZonePx = baselineY - xHeightY;

    // Measure font's x-height using letter 'x' at reference size
    const refSize = 200;
    ctx.font = `${refSize}px '${fontFamily}', cursive`;
    const xMetrics = ctx.measureText('x');
    const fontXHeight = xMetrics.actualBoundingBoxAscent || refSize * 0.5;

    // Scale so font x-height fills the x-height zone
    let fontSize = (xHeightZonePx / fontXHeight) * refSize;
    ctx.font = `${fontSize}px '${fontFamily}', cursive`;

    // Shrink if wider than canvas
    const textMetrics = ctx.measureText(text);
    if (textMetrics.width > canvasWidth * 0.92) {
      fontSize *= (canvasWidth * 0.92) / textMetrics.width;
      ctx.font = `${fontSize}px '${fontFamily}', cursive`;
    }

    // Clamp so glyphs stay within ascender–descender zone
    const fullMetrics = ctx.measureText(text);
    const ascent = fullMetrics.actualBoundingBoxAscent || fontSize * 0.8;
    const descent = fullMetrics.actualBoundingBoxDescent || fontSize * 0.2;
    const availableHeight = descenderY - ascenderY;
    if (ascent + descent > availableHeight) {
      fontSize *= availableHeight / (ascent + descent);
      ctx.font = `${fontSize}px '${fontFamily}', cursive`;
    }

    const finalMetrics = ctx.measureText(text);
    const textX = (canvasWidth - finalMetrics.width) / 2;

    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillText(text, textX, baselineY);
    ctx.globalAlpha = 1;
  }, [text, fontFamily, canvasWidth, canvasHeight, opacity, color, lineConfig]);

  if (!text) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[1]"
      style={{ width: canvasWidth, height: canvasHeight }}
    />
  );
}
