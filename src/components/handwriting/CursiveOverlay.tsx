import { useRef, useEffect } from 'react';

// Must match FourLineCanvas LINE_CONFIG
const LINE_CONFIG = {
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
}

export function CursiveOverlay({
  text,
  fontFamily,
  canvasWidth,
  canvasHeight,
  opacity = 0.2,
  color = '#94a3b8',
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

    // Target positions on canvas (px)
    const baselineY = canvasHeight * LINE_CONFIG.baseline / 100;
    const xHeightY = canvasHeight * LINE_CONFIG.xHeight / 100;
    const ascenderY = canvasHeight * LINE_CONFIG.ascender / 100;
    const descenderY = canvasHeight * LINE_CONFIG.descender / 100;

    // The vertical space between x-height line and baseline line
    const xHeightZonePx = baselineY - xHeightY;

    // Measure the font's x-height using the letter 'x' at a reference size
    const refSize = 200; // large reference for accuracy
    ctx.font = `${refSize}px '${fontFamily}', cursive`;
    const xMetrics = ctx.measureText('x');
    // actualBoundingBoxAscent of 'x' ≈ font's x-height in px at refSize
    const fontXHeight = xMetrics.actualBoundingBoxAscent || refSize * 0.5;

    // Scale so the font's x-height fills the x-height zone on canvas
    const fontSize = (xHeightZonePx / fontXHeight) * refSize;

    ctx.font = `${fontSize}px '${fontFamily}', cursive`;

    // Measure the actual text to center horizontally and check fit
    const textMetrics = ctx.measureText(text);
    let finalFontSize = fontSize;

    // Shrink if wider than canvas (with margin)
    if (textMetrics.width > canvasWidth * 0.92) {
      const scale = (canvasWidth * 0.92) / textMetrics.width;
      finalFontSize = fontSize * scale;
      ctx.font = `${finalFontSize}px '${fontFamily}', cursive`;
    }

    // Also ensure ascenders don't go above ascender line and descenders below descender line
    const fullMetrics = ctx.measureText(text);
    const ascent = fullMetrics.actualBoundingBoxAscent || finalFontSize * 0.8;
    const descent = fullMetrics.actualBoundingBoxDescent || finalFontSize * 0.2;

    // If the full glyph height exceeds the ascender-to-descender zone, scale down
    const availableHeight = descenderY - ascenderY;
    const totalGlyphHeight = ascent + descent;
    if (totalGlyphHeight > availableHeight) {
      const vScale = availableHeight / totalGlyphHeight;
      finalFontSize = finalFontSize * vScale;
      ctx.font = `${finalFontSize}px '${fontFamily}', cursive`;
    }

    // Re-measure with final font size
    const finalMetrics = ctx.measureText(text);
    const finalWidth = finalMetrics.width;

    // Place text on baseline, centered horizontally
    const textX = (canvasWidth - finalWidth) / 2;

    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillText(text, textX, baselineY);
    ctx.globalAlpha = 1;
  }, [text, fontFamily, canvasWidth, canvasHeight, opacity, color]);

  if (!text) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[1]"
      style={{ width: canvasWidth, height: canvasHeight }}
    />
  );
}
