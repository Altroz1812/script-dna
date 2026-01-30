import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FontMetadata {
  fontName: string;
  ascenderHeight: number;
  descenderDepth: number;
  globalKerning: number;
  lineHeight: number;
  xHeight: number;
}

interface CharacterData {
  character: string;
  vector_paths: string[];
  normalized_bezier: object[];
  mean_slant_angle: number;
  pressure_variance: number;
  stroke_count: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { metadata } = await req.json() as { metadata: FontMetadata };

    console.log('[compile-font] Starting font compilation for:', metadata.fontName);

    // Fetch all recorded characters
    const { data: characters, error: fetchError } = await supabase
      .from('font_library')
      .select('character, vector_paths, normalized_bezier, mean_slant_angle, pressure_variance, stroke_count');

    if (fetchError) {
      console.error('[compile-font] Error fetching characters:', fetchError);
      throw fetchError;
    }

    console.log(`[compile-font] Found ${characters?.length || 0} characters`);

    if (!characters || characters.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No characters found',
          message: 'Please record at least some characters before compiling.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build font manifest
    const fontManifest = {
      metadata: {
        fontFamily: metadata.fontName,
        unitsPerEm: 1000,
        ascender: metadata.ascenderHeight,
        descender: -metadata.descenderDepth,
        xHeight: metadata.xHeight,
        lineGap: Math.round((metadata.lineHeight - 100) / 100 * 200),
        defaultAdvanceWidth: 500 + metadata.globalKerning,
      },
      glyphs: characters.map((char: CharacterData) => ({
        unicode: char.character.charCodeAt(0),
        name: char.character.length === 1 
          ? `uni${char.character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
          : char.character,
        character: char.character,
        paths: char.vector_paths,
        metrics: {
          slantAngle: char.mean_slant_angle,
          pressureVariance: char.pressure_variance,
          strokeCount: char.stroke_count,
        },
        // Convert normalized bezier to SVG-compatible format
        outline: convertToOutline(char.normalized_bezier, metadata),
      })),
      kerning: generateKerningPairs(characters as CharacterData[], metadata.globalKerning),
      ligatures: characters
        .filter((c: CharacterData) => c.character.length > 1)
        .map((c: CharacterData) => ({
          components: c.character.split(''),
          replacement: c.character,
          paths: c.vector_paths,
        })),
    };

    console.log(`[compile-font] Built manifest with ${fontManifest.glyphs.length} glyphs`);

    // In production, this would call a Python service to compile the actual OTF
    // For now, we return the manifest that the Python service would use
    
    // The Python service would use fonttools like this:
    // from fontTools.fontBuilder import FontBuilder
    // from fontTools.pens.t2CharStringPen import T2CharStringPen
    // ... compile actual font binary ...

    return new Response(
      JSON.stringify({
        success: true,
        manifest: fontManifest,
        message: 'Font manifest generated. Connect Python FontTools service for OTF compilation.',
        stats: {
          totalGlyphs: fontManifest.glyphs.length,
          ligatures: fontManifest.ligatures.length,
          kerningPairs: fontManifest.kerning.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[compile-font] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function convertToOutline(normalizedBezier: object[], metadata: FontMetadata): string[] {
  // Convert normalized bezier points to font units (1000 units per em)
  const scale = 1000;
  const paths: string[] = [];

  if (!Array.isArray(normalizedBezier)) return paths;

  for (const stroke of normalizedBezier) {
    const points = (stroke as any).points || [];
    if (points.length < 2) continue;

    let path = `M ${Math.round(points[0].x * scale)} ${Math.round((1 - points[0].y) * scale)}`;
    
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      // Convert to cubic bezier for better curve quality
      path += ` L ${Math.round(p.x * scale)} ${Math.round((1 - p.y) * scale)}`;
    }
    
    paths.push(path);
  }

  return paths;
}

function generateKerningPairs(characters: CharacterData[], baseKerning: number): object[] {
  const kerning: object[] = [];
  const charSet = new Set(characters.map(c => c.character).filter(c => c.length === 1));
  
  // Common kerning adjustments
  const adjustments: Record<string, Record<string, number>> = {
    'A': { 'V': -50, 'W': -40, 'Y': -50, 'T': -30 },
    'V': { 'A': -50, 'a': -30, 'o': -20 },
    'T': { 'a': -40, 'e': -40, 'o': -40 },
    'L': { 'T': -30, 'V': -40, 'Y': -40 },
    'r': { '.': -20, ',': -20 },
    'f': { '.': -20, ',': -20, ')': -20 },
  };

  for (const [left, pairs] of Object.entries(adjustments)) {
    if (!charSet.has(left)) continue;
    for (const [right, value] of Object.entries(pairs)) {
      if (!charSet.has(right)) continue;
      kerning.push({
        left,
        right,
        value: value + baseKerning,
      });
    }
  }

  return kerning;
}
