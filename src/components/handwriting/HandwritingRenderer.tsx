import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CharacterData {
  character: string;
  vector_paths: string[];
  normalized_bezier: Array<{
    points: Array<{ x: number; y: number; pressure: number }>;
    color: string;
    width: number;
  }>;
}

interface HandwritingRendererProps {
  text: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  className?: string;
}

export function HandwritingRenderer({
  text,
  fontSize,
  lineHeight,
  letterSpacing,
  className = '',
}: HandwritingRendererProps) {
  const [characterLibrary, setCharacterLibrary] = useState<Map<string, CharacterData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCharacters = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('font_library')
          .select('character, vector_paths, normalized_bezier')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Build a map of unique characters (use most recent recording for each)
        const charMap = new Map<string, CharacterData>();
        for (const row of data || []) {
          if (!charMap.has(row.character)) {
            charMap.set(row.character, {
              character: row.character,
              vector_paths: row.vector_paths as string[],
              normalized_bezier: row.normalized_bezier as CharacterData['normalized_bezier'],
            });
          }
        }
        setCharacterLibrary(charMap);
      } catch (error) {
        console.error('Error loading character library:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCharacters();
  }, []);

  // Calculate character dimensions
  const charWidth = fontSize * 0.6;
  const charHeight = fontSize * 1.2;
  const spacing = charWidth * (1 + letterSpacing / 100);
  const lineHeightPx = charHeight * (lineHeight / 100);

  // Split text into lines
  const lines = text.split('\n');

  // Calculate SVG dimensions
  const maxLineLength = Math.max(...lines.map(line => line.length));
  const svgWidth = Math.max(100, maxLineLength * spacing + charWidth);
  const svgHeight = Math.max(50, lines.length * lineHeightPx + charHeight);

  const renderedContent = useMemo(() => {
    if (isLoading) return null;

    return lines.map((line, lineIndex) => {
      const yOffset = lineIndex * lineHeightPx;
      
      return line.split('').map((char, charIndex) => {
        const xOffset = charIndex * spacing;
        const charData = characterLibrary.get(char);

        if (char === ' ') {
          // Space character - just advance position
          return null;
        }

        if (!charData || !charData.normalized_bezier || charData.normalized_bezier.length === 0) {
          // Character not recorded - show placeholder
          return (
            <g key={`${lineIndex}-${charIndex}`} transform={`translate(${xOffset}, ${yOffset})`}>
              <text
                x={charWidth / 2}
                y={charHeight * 0.7}
                fontSize={fontSize * 0.8}
                fill="hsl(var(--muted-foreground))"
                textAnchor="middle"
                fontFamily="monospace"
                opacity={0.5}
              >
                {char}
              </text>
            </g>
          );
        }

        // Render the handwritten character from normalized bezier data
        // First, compute bounding box of normalized points to fit character into cell
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const stroke of charData.normalized_bezier) {
          if (!stroke.points) continue;
          for (const p of stroke.points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }
        }
        const bw = maxX - minX || 0.01;
        const bh = maxY - minY || 0.01;
        // Fit into character cell with some padding
        const pad = 0.1;
        const availW = charWidth * (1 - pad * 2);
        const availH = charHeight * (1 - pad * 2);
        const fitScale = Math.min(availW / bw, availH / bh);
        const offX = (charWidth - bw * fitScale) / 2;
        const offY = (charHeight - bh * fitScale) / 2;

        return (
          <g key={`${lineIndex}-${charIndex}`} transform={`translate(${xOffset}, ${yOffset})`}>
            {charData.normalized_bezier.map((stroke, strokeIndex) => {
              if (!stroke.points || stroke.points.length < 2) return null;

              let pathD = '';
              stroke.points.forEach((point, i) => {
                const x = (point.x - minX) * fitScale + offX;
                const y = (point.y - minY) * fitScale + offY;
                if (i === 0) {
                  pathD += `M ${x} ${y}`;
                } else {
                  const prevPoint = stroke.points[i - 1];
                  const prevX = (prevPoint.x - minX) * fitScale + offX;
                  const prevY = (prevPoint.y - minY) * fitScale + offY;
                  const midX = (prevX + x) / 2;
                  const midY = (prevY + y) / 2;
                  pathD += ` Q ${prevX} ${prevY} ${midX} ${midY}`;
                }
              });

              const strokeWidth = Math.max(1, (stroke.width || 4) * (fontSize / 32));

              return (
                <path
                  key={strokeIndex}
                  d={pathD}
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              );
            })}
          </g>
        );
      });
    });
  }, [text, characterLibrary, isLoading, fontSize, charWidth, charHeight, spacing, lineHeightPx, lines]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ minHeight: 100 }}>
        <div className="text-muted-foreground text-sm">Loading your handwriting...</div>
      </div>
    );
  }

  if (characterLibrary.size === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ minHeight: 100 }}>
        <div className="text-muted-foreground text-sm text-center">
          No characters recorded yet.<br />
          Record some characters to see your handwriting here.
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-auto ${className}`}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="text-foreground"
      >
        {renderedContent}
      </svg>
    </div>
  );
}
