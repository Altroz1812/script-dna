import { useRef, useEffect } from 'react';

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
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;

    // Size the font to fit within the writing zone (between ~12.5% and ~87.5% of height)
    const zoneTop = canvasHeight * 0.125;
    const zoneBottom = canvasHeight * 0.875;
    const zoneHeight = zoneBottom - zoneTop;
    
    // Start with a large font and shrink to fit width
    let fontSize = zoneHeight * 0.7;
    ctx.font = `${fontSize}px '${fontFamily}', cursive`;
    let measured = ctx.measureText(text);
    
    // Shrink if wider than canvas
    while (measured.width > canvasWidth * 0.9 && fontSize > 12) {
      fontSize -= 2;
      ctx.font = `${fontSize}px '${fontFamily}', cursive`;
      measured = ctx.measureText(text);
    }

    // Center horizontally, place on baseline (~62.5% of height)
    const baselineY = canvasHeight * 0.625;
    const textX = (canvasWidth - measured.width) / 2;
    
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
