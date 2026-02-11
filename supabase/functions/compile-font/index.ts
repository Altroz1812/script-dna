import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// ── TTF Binary Builder ──────────────────────────────────────────

class BinaryWriter {
  private buf: number[] = [];

  uint8(v: number) { this.buf.push(v & 0xFF); }
  uint16(v: number) { this.buf.push((v >> 8) & 0xFF, v & 0xFF); }
  int16(v: number) { this.uint16(v < 0 ? v + 0x10000 : v); }
  uint32(v: number) {
    this.buf.push((v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF);
  }
  int32(v: number) { this.uint32(v < 0 ? v + 0x100000000 : v); }
  tag(s: string) { for (let i = 0; i < 4; i++) this.buf.push(s.charCodeAt(i)); }
  bytes(arr: number[]) { this.buf.push(...arr); }
  pad(align: number) {
    while (this.buf.length % align !== 0) this.buf.push(0);
  }
  length() { return this.buf.length; }
  toUint8Array() { return new Uint8Array(this.buf); }
}

function calcChecksum(data: Uint8Array): number {
  let sum = 0;
  const len = data.length;
  const padded = new Uint8Array(len + (4 - (len % 4)) % 4);
  padded.set(data);
  for (let i = 0; i < padded.length; i += 4) {
    sum = (sum + ((padded[i] << 24) | (padded[i+1] << 16) | (padded[i+2] << 8) | padded[i+3])) >>> 0;
  }
  return sum;
}

interface GlyphOutline {
  xCoords: number[];
  yCoords: number[];
  flags: number[];
  contourEnds: number[];
  xMin: number; yMin: number; xMax: number; yMax: number;
  advanceWidth: number;
  lsb: number;
}

function pathToGlyph(pathStr: string, unitsPerEm: number, canvasW: number, canvasH: number): GlyphOutline {
  // Parse SVG-like path "M x y L x y ..."
  const tokens = pathStr.trim().split(/[\s,]+/);
  const rawPts: { x: number; y: number }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === 'M' || cmd === 'L') {
      const x = parseFloat(tokens[i + 1]);
      const y = parseFloat(tokens[i + 2]);
      rawPts.push({ x, y });
      i += 3;
    } else if (!isNaN(parseFloat(cmd))) {
      // Implicit L
      const x = parseFloat(tokens[i]);
      const y = parseFloat(tokens[i + 1]);
      rawPts.push({ x, y });
      i += 2;
    } else {
      i++;
    }
  }

  if (rawPts.length === 0) {
    return { xCoords: [], yCoords: [], flags: [], contourEnds: [], xMin: 0, yMin: 0, xMax: 0, yMax: 0, advanceWidth: unitsPerEm / 2, lsb: 0 };
  }

  // Scale from canvas coords to font units
  // Canvas Y goes down, font Y goes up
  const scale = unitsPerEm / Math.max(canvasW, canvasH);
  const pts = rawPts.map(p => ({
    x: Math.round(p.x * scale),
    y: Math.round((canvasH - p.y) * scale), // flip Y
  }));

  // Build a stroke outline by creating a closed contour with thickness
  const thickness = Math.round(unitsPerEm * 0.04); // ~4% of em for stroke width

  // Forward path
  const forward = pts.map(p => p);
  // Backward path offset
  const backward: { x: number; y: number }[] = [];
  for (let j = 0; j < pts.length; j++) {
    let nx = 0, ny = 0;
    if (j < pts.length - 1) {
      const dx = pts[j + 1].x - pts[j].x;
      const dy = pts[j + 1].y - pts[j].y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len * thickness;
      ny = dx / len * thickness;
    } else if (j > 0) {
      const dx = pts[j].x - pts[j - 1].x;
      const dy = pts[j].y - pts[j - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len * thickness;
      ny = dx / len * thickness;
    }
    backward.push({ x: pts[j].x + nx, y: pts[j].y + ny });
  }
  backward.reverse();

  const allPts = [...forward, ...backward];
  const xCoords = allPts.map(p => p.x);
  const yCoords = allPts.map(p => p.y);
  const flags = allPts.map(() => 1); // all on-curve
  const contourEnds = [allPts.length - 1];

  const xMin = Math.min(...xCoords);
  const yMin = Math.min(...yCoords);
  const xMax = Math.max(...xCoords);
  const yMax = Math.max(...yCoords);

  return {
    xCoords, yCoords, flags, contourEnds,
    xMin, yMin, xMax, yMax,
    advanceWidth: (xMax - xMin) + Math.round(unitsPerEm * 0.1),
    lsb: xMin,
  };
}

function mergeGlyphOutlines(outlines: GlyphOutline[]): GlyphOutline {
  if (outlines.length === 0) {
    return { xCoords: [], yCoords: [], flags: [], contourEnds: [], xMin: 0, yMin: 0, xMax: 0, yMax: 0, advanceWidth: 500, lsb: 0 };
  }
  const xCoords: number[] = [];
  const yCoords: number[] = [];
  const flags: number[] = [];
  const contourEnds: number[] = [];
  let offset = 0;
  for (const o of outlines) {
    xCoords.push(...o.xCoords);
    yCoords.push(...o.yCoords);
    flags.push(...o.flags);
    for (const ce of o.contourEnds) {
      contourEnds.push(ce + offset);
    }
    offset += o.xCoords.length;
  }
  const xMin = Math.min(...xCoords);
  const yMin = Math.min(...yCoords);
  const xMax = Math.max(...xCoords);
  const yMax = Math.max(...yCoords);
  return {
    xCoords, yCoords, flags, contourEnds,
    xMin, yMin, xMax, yMax,
    advanceWidth: outlines[0].advanceWidth,
    lsb: outlines[0].lsb,
  };
}

function writeGlyf(glyph: GlyphOutline): Uint8Array {
  const w = new BinaryWriter();
  if (glyph.xCoords.length === 0) {
    // Empty glyph (e.g. space)
    return new Uint8Array(0);
  }
  w.int16(glyph.contourEnds.length); // numberOfContours
  w.int16(glyph.xMin);
  w.int16(glyph.yMin);
  w.int16(glyph.xMax);
  w.int16(glyph.yMax);
  for (const ce of glyph.contourEnds) w.uint16(ce);
  w.uint16(0); // instructionLength
  // Flags
  for (const f of glyph.flags) w.uint8(f);
  // X coordinates (delta-encoded)
  let prevX = 0;
  for (const x of glyph.xCoords) {
    const dx = x - prevX;
    if (dx >= 0 && dx <= 255) {
      // flag already has bit set for short positive — but we use simple encoding
    }
    w.int16(dx);
    prevX = x;
  }
  // Y coordinates (delta-encoded)
  let prevY = 0;
  for (const y of glyph.yCoords) {
    const dy = y - prevY;
    w.int16(dy);
    prevY = y;
  }
  w.pad(4);
  return w.toUint8Array();
}

// Actually, TrueType glyf table encoding is more nuanced. Let me use a simpler
// but correct approach with proper flag encoding.
function writeGlyfProper(glyph: GlyphOutline): Uint8Array {
  if (glyph.xCoords.length === 0) return new Uint8Array(0);

  const w = new BinaryWriter();
  w.int16(glyph.contourEnds.length);
  w.int16(glyph.xMin);
  w.int16(glyph.yMin);
  w.int16(glyph.xMax);
  w.int16(glyph.yMax);

  for (const ce of glyph.contourEnds) w.uint16(ce);
  w.uint16(0); // instruction length

  // Compute deltas
  const xDeltas: number[] = [];
  const yDeltas: number[] = [];
  let px = 0, py = 0;
  for (let i = 0; i < glyph.xCoords.length; i++) {
    xDeltas.push(glyph.xCoords[i] - px);
    yDeltas.push(glyph.yCoords[i] - py);
    px = glyph.xCoords[i];
    py = glyph.yCoords[i];
  }

  // Build flags and coordinate arrays
  const flagBytes: number[] = [];
  const xBytes: number[] = [];
  const yBytes: number[] = [];

  for (let i = 0; i < glyph.xCoords.length; i++) {
    let flag = glyph.flags[i] & 1; // on-curve bit
    const dx = xDeltas[i];
    const dy = yDeltas[i];

    // X encoding
    if (dx === 0) {
      flag |= 0x10; // x is same
    } else if (dx >= -255 && dx <= 255) {
      flag |= 0x02; // x is 1 byte
      if (dx > 0) flag |= 0x10; // positive
    }

    // Y encoding
    if (dy === 0) {
      flag |= 0x20; // y is same
    } else if (dy >= -255 && dy <= 255) {
      flag |= 0x04; // y is 1 byte
      if (dy > 0) flag |= 0x20; // positive
    }

    flagBytes.push(flag);

    // X data
    if (dx === 0) {
      // nothing
    } else if (flag & 0x02) {
      xBytes.push(Math.abs(dx));
    } else {
      xBytes.push((dx >> 8) & 0xFF, dx & 0xFF);
    }

    // Y data
    if (dy === 0) {
      // nothing
    } else if (flag & 0x04) {
      yBytes.push(Math.abs(dy));
    } else {
      yBytes.push((dy >> 8) & 0xFF, dy & 0xFF);
    }
  }

  w.bytes(flagBytes);
  w.bytes(xBytes);
  w.bytes(yBytes);
  w.pad(2);
  return w.toUint8Array();
}

function buildTTF(
  fontName: string,
  metadata: FontMetadata,
  glyphs: { unicode: number; outline: GlyphOutline }[],
): Uint8Array {
  const unitsPerEm = 1000;
  const ascender = metadata.ascenderHeight || 800;
  const descender = -(metadata.descenderDepth || 200);

  // Sort glyphs by unicode
  glyphs.sort((a, b) => a.unicode - b.unicode);

  // Prepend .notdef and space
  const notdefGlyph: GlyphOutline = {
    xCoords: [100, 100, 400, 400],
    yCoords: [0, 700, 700, 0],
    flags: [1, 1, 1, 1],
    contourEnds: [3],
    xMin: 100, yMin: 0, xMax: 400, yMax: 700,
    advanceWidth: 500, lsb: 100,
  };
  const spaceGlyph: GlyphOutline = {
    xCoords: [], yCoords: [], flags: [], contourEnds: [],
    xMin: 0, yMin: 0, xMax: 0, yMax: 0,
    advanceWidth: 250, lsb: 0,
  };

  const allGlyphs = [
    { unicode: 0, outline: notdefGlyph },    // .notdef (GID 0)
    { unicode: 32, outline: spaceGlyph },     // space
    ...glyphs.filter(g => g.unicode !== 32),  // user glyphs
  ];

  const numGlyphs = allGlyphs.length;

  // ── Build glyf data and loca ──
  const glyfDatas: Uint8Array[] = [];
  const offsets: number[] = [];
  let glyfOffset = 0;
  for (const g of allGlyphs) {
    offsets.push(glyfOffset);
    const data = writeGlyfProper(g.outline);
    glyfDatas.push(data);
    glyfOffset += data.length;
  }
  offsets.push(glyfOffset); // final offset

  const useShortLoca = glyfOffset < 0x20000;

  // Concatenate glyf
  const glyfTable = new Uint8Array(glyfOffset);
  let pos = 0;
  for (const d of glyfDatas) {
    glyfTable.set(d, pos);
    pos += d.length;
  }

  // ── loca table ──
  const locaW = new BinaryWriter();
  if (useShortLoca) {
    for (const o of offsets) locaW.uint16(o / 2);
  } else {
    for (const o of offsets) locaW.uint32(o);
  }

  // ── cmap table (Format 4) ──
  const cmapW = new BinaryWriter();
  cmapW.uint16(0);  // version
  cmapW.uint16(1);  // numTables
  cmapW.uint16(3);  // platformID (Windows)
  cmapW.uint16(1);  // encodingID (Unicode BMP)
  cmapW.uint32(12); // offset to subtable

  // Build segments for Format 4
  const charToGid = new Map<number, number>();
  allGlyphs.forEach((g, i) => { if (g.unicode > 0) charToGid.set(g.unicode, i); });
  const unicodes = [...charToGid.keys()].sort((a, b) => a - b);

  // Group into segments
  const segments: { start: number; end: number; gids: number[] }[] = [];
  if (unicodes.length > 0) {
    let seg = { start: unicodes[0], end: unicodes[0], gids: [charToGid.get(unicodes[0])!] };
    for (let i = 1; i < unicodes.length; i++) {
      if (unicodes[i] === seg.end + 1) {
        seg.end = unicodes[i];
        seg.gids.push(charToGid.get(unicodes[i])!);
      } else {
        segments.push(seg);
        seg = { start: unicodes[i], end: unicodes[i], gids: [charToGid.get(unicodes[i])!] };
      }
    }
    segments.push(seg);
  }
  // Add sentinel
  segments.push({ start: 0xFFFF, end: 0xFFFF, gids: [0] });

  const segCount = segments.length;
  const searchRange = Math.pow(2, Math.floor(Math.log2(segCount))) * 2;
  const entrySelector = Math.floor(Math.log2(segCount));
  const rangeShift = segCount * 2 - searchRange;

  // Check if we can use idDelta (sequential mapping)
  const useIdRangeOffset = segments.some((seg, idx) => {
    if (idx === segments.length - 1) return false; // sentinel
    for (let j = 0; j < seg.gids.length; j++) {
      if (seg.gids[j] !== seg.gids[0] + j) return true;
    }
    return false;
  });

  cmapW.uint16(4);  // format
  // We'll calculate length after
  const cmapSubStart = cmapW.length();
  cmapW.uint16(0);  // placeholder for length
  cmapW.uint16(0);  // language
  cmapW.uint16(segCount * 2);
  cmapW.uint16(searchRange);
  cmapW.uint16(entrySelector);
  cmapW.uint16(rangeShift);

  // endCode
  for (const seg of segments) cmapW.uint16(seg.end);
  cmapW.uint16(0); // reservedPad

  // startCode
  for (const seg of segments) cmapW.uint16(seg.start);

  // idDelta — use simple delta approach
  // glyphIdArray for complex mappings
  const glyphIdArrays: number[][] = [];
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    if (si === segments.length - 1) {
      cmapW.int16(1); // sentinel delta
    } else {
      // Check if sequential
      let sequential = true;
      for (let j = 1; j < seg.gids.length; j++) {
        if (seg.gids[j] !== seg.gids[0] + j) { sequential = false; break; }
      }
      if (sequential) {
        cmapW.int16((seg.gids[0] - seg.start) & 0xFFFF);
      } else {
        cmapW.int16(0);
      }
    }
  }

  // idRangeOffset — for simplicity use 0 (works when sequential)
  for (const _seg of segments) cmapW.uint16(0);

  // Fix cmap subtable length
  const cmapData = cmapW.toUint8Array();
  const cmapLen = cmapData.length - 12; // subtract header
  cmapData[cmapSubStart] = (cmapLen >> 8) & 0xFF;
  cmapData[cmapSubStart + 1] = cmapLen & 0xFF;

  // ── head table ──
  const headW = new BinaryWriter();
  const now = Math.floor(Date.now() / 1000) + 2082844800; // Mac epoch
  headW.uint16(1); headW.uint16(0); // version 1.0
  headW.uint16(1); headW.uint16(0); // fontRevision
  headW.uint32(0); // checksumAdjustment (fill later)
  headW.uint32(0x5F0F3CF5); // magicNumber
  headW.uint16(0x000B); // flags
  headW.uint16(unitsPerEm);
  headW.uint32(now >> 16); headW.uint32(now & 0xFFFF); // created (simplified)
  headW.uint32(now >> 16); headW.uint32(now & 0xFFFF); // modified
  // Compute global bounds
  let gXMin = 0, gYMin = 0, gXMax = 0, gYMax = 0;
  for (const g of allGlyphs) {
    gXMin = Math.min(gXMin, g.outline.xMin);
    gYMin = Math.min(gYMin, g.outline.yMin);
    gXMax = Math.max(gXMax, g.outline.xMax);
    gYMax = Math.max(gYMax, g.outline.yMax);
  }
  headW.int16(gXMin); headW.int16(gYMin);
  headW.int16(gXMax); headW.int16(gYMax);
  headW.uint16(0); // macStyle
  headW.uint16(8); // lowestRecPPEM
  headW.int16(2); // fontDirectionHint
  headW.int16(useShortLoca ? 0 : 1); // indexToLocFormat
  headW.int16(0); // glyphDataFormat

  // ── hhea table ──
  const hheaW = new BinaryWriter();
  hheaW.uint16(1); hheaW.uint16(0); // version
  hheaW.int16(ascender);
  hheaW.int16(descender);
  hheaW.int16(0); // lineGap
  const maxAW = Math.max(...allGlyphs.map(g => g.outline.advanceWidth));
  hheaW.uint16(maxAW); // advanceWidthMax
  hheaW.int16(gXMin); // minLeftSideBearing
  hheaW.int16(gXMin); // minRightSideBearing
  hheaW.int16(gXMax); // xMaxExtent
  hheaW.int16(1); hheaW.int16(0); // caretSlopeRise/Run
  for (let ri = 0; ri < 5; ri++) hheaW.int16(0); // reserved
  hheaW.int16(0); // metricDataFormat
  hheaW.uint16(numGlyphs); // numberOfHMetrics

  // ── hmtx table ──
  const hmtxW = new BinaryWriter();
  for (const g of allGlyphs) {
    hmtxW.uint16(g.outline.advanceWidth);
    hmtxW.int16(g.outline.lsb);
  }

  // ── maxp table ──
  const maxpW = new BinaryWriter();
  maxpW.uint16(1); maxpW.uint16(0); // version 1.0
  maxpW.uint16(numGlyphs);
  const maxPts = Math.max(1, ...allGlyphs.map(g => g.outline.xCoords.length));
  const maxContours = Math.max(1, ...allGlyphs.map(g => g.outline.contourEnds.length));
  maxpW.uint16(maxPts);   // maxPoints
  maxpW.uint16(maxContours); // maxContours
  maxpW.uint16(0); // maxCompositePoints
  maxpW.uint16(0); // maxCompositeContours
  maxpW.uint16(1); // maxZones
  maxpW.uint16(0); // maxTwilightPoints
  maxpW.uint16(0); // maxStorage
  maxpW.uint16(0); // maxFunctionDefs
  maxpW.uint16(0); // maxInstructionDefs
  maxpW.uint16(0); // maxStackElements
  maxpW.uint16(0); // maxSizeOfInstructions
  maxpW.uint16(0); // maxComponentElements
  maxpW.uint16(0); // maxComponentDepth

  // ── name table ──
  const nameW = new BinaryWriter();
  const nameStrings = [
    /* 0 */ fontName, // copyright
    /* 1 */ fontName, // fontFamily
    /* 2 */ 'Regular', // subfamilyName
    /* 3 */ `${fontName}-Regular`, // uniqueID
    /* 4 */ fontName, // fullName
    /* 5 */ 'Version 1.0', // version
    /* 6 */ fontName.replace(/\s+/g, ''), // postScriptName
  ];

  nameW.uint16(0); // format
  nameW.uint16(nameStrings.length); // count
  const stringOffset = 6 + nameStrings.length * 12;
  nameW.uint16(stringOffset);

  // Encode strings as UTF-16BE
  const encodedStrings: Uint8Array[] = [];
  let strOff = 0;
  for (let ni = 0; ni < nameStrings.length; ni++) {
    const str = nameStrings[ni];
    const encoded = new Uint8Array(str.length * 2);
    for (let ci = 0; ci < str.length; ci++) {
      const code = str.charCodeAt(ci);
      encoded[ci * 2] = (code >> 8) & 0xFF;
      encoded[ci * 2 + 1] = code & 0xFF;
    }
    encodedStrings.push(encoded);

    nameW.uint16(3); // platformID (Windows)
    nameW.uint16(1); // encodingID (Unicode BMP)
    nameW.uint16(0x0409); // languageID (English US)
    nameW.uint16(ni); // nameID
    nameW.uint16(encoded.length);
    nameW.uint16(strOff);
    strOff += encoded.length;
  }

  // Append string data
  for (const es of encodedStrings) nameW.bytes([...es]);

  // ── post table ──
  const postW = new BinaryWriter();
  postW.uint16(3); postW.uint16(0); // version 3.0 (no glyph names)
  postW.int32(0); // italicAngle
  postW.int16(-100); // underlinePosition
  postW.int16(50); // underlineThickness
  postW.uint32(0); // isFixedPitch
  postW.uint32(0); // minMemType42
  postW.uint32(0); // maxMemType42
  postW.uint32(0); // minMemType1
  postW.uint32(0); // maxMemType1

  // ── OS/2 table ──
  const os2W = new BinaryWriter();
  os2W.uint16(4); // version
  os2W.int16(Math.round(maxAW * 0.5)); // xAvgCharWidth
  os2W.uint16(400); // usWeightClass (Regular)
  os2W.uint16(5); // usWidthClass (Medium)
  os2W.uint16(0); // fsType
  os2W.int16(Math.round(unitsPerEm * 0.1)); // ySubscriptXSize
  os2W.int16(Math.round(unitsPerEm * 0.1)); // ySubscriptYSize
  os2W.int16(0); // ySubscriptXOffset
  os2W.int16(0); // ySubscriptYOffset
  os2W.int16(Math.round(unitsPerEm * 0.1)); // ySuperscriptXSize
  os2W.int16(Math.round(unitsPerEm * 0.1)); // ySuperscriptYSize
  os2W.int16(0); // ySuperscriptXOffset
  os2W.int16(Math.round(unitsPerEm * 0.3)); // ySuperscriptYOffset
  os2W.int16(Math.round(unitsPerEm * 0.05)); // yStrikeoutSize
  os2W.int16(Math.round(unitsPerEm * 0.3)); // yStrikeoutPosition
  os2W.int16(0); // sFamilyClass
  for (let pi = 0; pi < 10; pi++) os2W.uint8(0); // panose
  // ulUnicodeRange1-4
  os2W.uint32(1); os2W.uint32(0); os2W.uint32(0); os2W.uint32(0);
  os2W.tag('    '); // achVendID
  os2W.uint16(0x0040); // fsSelection (Regular)
  const minUnicode = Math.min(...unicodes.filter(u => u < 0xFFFF));
  const maxUnicode = Math.max(...unicodes.filter(u => u < 0xFFFF));
  os2W.uint16(minUnicode || 32); // usFirstCharIndex
  os2W.uint16(maxUnicode || 122); // usLastCharIndex
  os2W.int16(ascender); // sTypoAscender
  os2W.int16(descender); // sTypoDescender
  os2W.int16(0); // sTypoLineGap
  os2W.uint16(ascender); // usWinAscent
  os2W.uint16(Math.abs(descender)); // usWinDescent
  os2W.uint32(1); os2W.uint32(0); // ulCodePageRange
  os2W.int16(metadata.xHeight || Math.round(unitsPerEm * 0.5)); // sxHeight
  os2W.int16(ascender); // sCapHeight
  os2W.uint16(0); // usDefaultChar
  os2W.uint16(32); // usBreakChar
  os2W.uint16(1); // usMaxContext

  // ── Assemble tables ──
  const tables: { tag: string; data: Uint8Array }[] = [
    { tag: 'cmap', data: cmapData },
    { tag: 'glyf', data: glyfTable },
    { tag: 'head', data: headW.toUint8Array() },
    { tag: 'hhea', data: hheaW.toUint8Array() },
    { tag: 'hmtx', data: hmtxW.toUint8Array() },
    { tag: 'loca', data: locaW.toUint8Array() },
    { tag: 'maxp', data: maxpW.toUint8Array() },
    { tag: 'name', data: nameW.toUint8Array() },
    { tag: 'OS/2', data: os2W.toUint8Array() },
    { tag: 'post', data: postW.toUint8Array() },
  ];

  tables.sort((a, b) => a.tag < b.tag ? -1 : 1);

  const numTables = tables.length;
  const sR = Math.pow(2, Math.floor(Math.log2(numTables))) * 16;
  const eS = Math.floor(Math.log2(numTables));
  const rS = numTables * 16 - sR;

  const headerSize = 12 + numTables * 16;
  let dataOffset = headerSize;
  // Pad each table to 4 bytes
  const paddedTables = tables.map(t => {
    const padLen = (4 - (t.data.length % 4)) % 4;
    if (padLen === 0) return t.data;
    const padded = new Uint8Array(t.data.length + padLen);
    padded.set(t.data);
    return padded;
  });

  // Build offsets
  const tableRecords: { tag: string; checksum: number; offset: number; length: number }[] = [];
  let off = headerSize;
  for (let ti = 0; ti < tables.length; ti++) {
    tableRecords.push({
      tag: tables[ti].tag,
      checksum: calcChecksum(paddedTables[ti]),
      offset: off,
      length: tables[ti].data.length,
    });
    off += paddedTables[ti].length;
  }

  // Write final file
  const finalW = new BinaryWriter();
  finalW.uint32(0x00010000); // sfVersion (TrueType)
  finalW.uint16(numTables);
  finalW.uint16(sR);
  finalW.uint16(eS);
  finalW.uint16(rS);

  for (const rec of tableRecords) {
    finalW.tag(rec.tag);
    finalW.uint32(rec.checksum);
    finalW.uint32(rec.offset);
    finalW.uint32(rec.length);
  }

  for (const pt of paddedTables) {
    finalW.bytes([...pt]);
  }

  return finalW.toUint8Array();
}

// ── Main Handler ──────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { metadata } = await req.json() as { metadata: FontMetadata };

    console.log('[compile-font] Starting font compilation for:', metadata.fontName);

    const { data: characters, error: fetchError } = await supabase
      .from('font_library')
      .select('character, vector_paths, normalized_bezier, mean_slant_angle, pressure_variance, stroke_count');

    if (fetchError) throw fetchError;

    console.log(`[compile-font] Found ${characters?.length || 0} characters`);

    if (!characters || characters.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No characters found', message: 'Please record at least some characters before compiling.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Canvas dimensions used during recording (matches FourLineCanvas)
    const canvasW = 500;
    const canvasH = 350;
    const unitsPerEm = 1000;

    // Convert each character's paths to glyph outlines
    const glyphs: { unicode: number; outline: GlyphOutline }[] = [];

    for (const char of characters as CharacterData[]) {
      if (char.character.length !== 1) continue; // skip ligatures for now
      const unicode = char.character.charCodeAt(0);
      const paths = (char.vector_paths as string[]) || [];
      const outlines = paths
        .filter((p: string) => p && p.length > 0)
        .map((p: string) => pathToGlyph(p, unitsPerEm, canvasW, canvasH));

      if (outlines.length === 0) continue;

      const merged = outlines.length === 1 ? outlines[0] : mergeGlyphOutlines(outlines);
      // Apply global kerning to advance width
      merged.advanceWidth = Math.max(100, merged.advanceWidth + (metadata.globalKerning || 0));
      glyphs.push({ unicode, outline: merged });
    }

    console.log(`[compile-font] Building TTF with ${glyphs.length} glyphs`);

    const ttfData = buildTTF(metadata.fontName, metadata, glyphs);

    console.log(`[compile-font] TTF generated: ${ttfData.length} bytes`);

    return new Response(ttfData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'font/ttf',
        'Content-Disposition': `attachment; filename="${metadata.fontName.replace(/\s+/g, '-')}.ttf"`,
      },
    });

  } catch (error) {
    console.error('[compile-font] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
