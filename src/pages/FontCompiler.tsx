import { useState, useCallback, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Wand2, Download, RotateCcw, PenTool, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CharacterGrid } from '@/components/handwriting/CharacterGrid';
import { FourLineCanvas } from '@/components/handwriting/FourLineCanvas';
import { FontMetadataConfig, FontMetadata } from '@/components/handwriting/FontMetadataConfig';
import { LiveTypeTester } from '@/components/handwriting/LiveTypeTester';
import { LigatureEngine } from '@/components/handwriting/LigatureEngine';
import { CanvasToolbar } from '@/components/handwriting/CanvasToolbar';
import { StrokeValidationFeedback } from '@/components/handwriting/StrokeValidationFeedback';
import { FontUploadPanel, UploadedFont } from '@/components/handwriting/FontUploadPanel';
import { TracingSessionRecorder } from '@/components/handwriting/TracingSessionRecorder';
import { useStrokeCapture } from '@/hooks/useStrokeCapture';
import { useStrokeValidator } from '@/hooks/useStrokeValidator';
import { ToolbarConfig } from '@/types/handwriting';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type CompilerMode = 'build' | 'trace';

const FontCompiler = () => {
  const [mode, setMode] = useState<CompilerMode>('build');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [toolbarConfig, setToolbarConfig] = useState<ToolbarConfig>({
    brushWidth: 4,
    penColor: '#3b82f6',
    overlay: 'none',
    activeTool: 'pen',
  });
  const [fontMetadata, setFontMetadata] = useState<FontMetadata>({
    fontName: 'My Handwriting',
    ascenderHeight: 200,
    descenderDepth: 150,
    globalKerning: 0,
    lineHeight: 120,
    xHeight: 300,
  });

  // Trace mode state
  const [activeFont, setActiveFont] = useState<UploadedFont | null>(null);
  const [wordMode, setWordMode] = useState(false);
  const [wordText, setWordText] = useState('');
  const [overlayOpacity, setOverlayOpacity] = useState(0.2);
  const [overlayColor, setOverlayColor] = useState('#94a3b8');

  const {
    strokes, currentStroke, metrics,
    startStroke, continueStroke, endStroke, undo, redo, canUndo, canRedo, clear,
    replaceLastStroke, eraseAtPoint, startErase, endErase, addStamp,
    moveStrokes, scaleStrokes, changeStrokeWidth, resizeStrokes,
    flipStrokes, rotateStrokes, flipAll, rotateAll, loadStrokes,
  } = useStrokeCapture();

  const lastOutOfBoundsToastAtRef = useRef<number>(0);

  const validationMetrics = useStrokeValidator({
    strokes, currentStroke, canvasHeight,
  });

  const handleConfigChange = useCallback((config: Partial<ToolbarConfig>) => {
    setToolbarConfig(prev => ({ ...prev, ...config }));
  }, []);

  const handleEndStroke = useCallback(() => {
    endStroke(toolbarConfig.penColor, toolbarConfig.brushWidth);
  }, [endStroke, toolbarConfig.penColor, toolbarConfig.brushWidth]);

  const handleSelectCharacter = async (char: string) => {
    setSelectedCharacter(char);

    // In trace mode, don't load existing strokes — just clear for tracing
    if (mode === 'trace') {
      clear();
      return;
    }

    // Build mode: load existing saved strokes
    try {
      const { data, error } = await supabase
        .from('font_library')
        .select('normalized_bezier')
        .eq('character', char)
        .single();

      if (error || !data) { clear(); return; }

      const bezierData = data.normalized_bezier as Array<{
        points: Array<{ x: number; y: number; pressure: number }>;
        color: string; width: number;
      }>;

      if (!Array.isArray(bezierData) || bezierData.length === 0) { clear(); return; }

      const canvasW = 500;
      const canvasH = 300;
      const now = performance.now();

      const restoredStrokes: import('@/types/handwriting').StrokeData[] = bezierData.map((stroke, i) => ({
        id: crypto.randomUUID(),
        points: (stroke.points || []).map((p, j) => ({
          x: p.x * canvasW, y: p.y * canvasH,
          pressure: p.pressure ?? 0.5, velocity: 0,
          timestamp: now + i * 1000 + j,
        })),
        color: stroke.color || '#3b82f6',
        width: stroke.width || 4,
        startTime: now + i * 1000,
        endTime: now + i * 1000 + (stroke.points?.length || 0),
      }));

      loadStrokes(restoredStrokes);
      toast({ title: "Character Loaded", description: `Editing saved "${char}" — modify and save to update.` });
    } catch (err) {
      console.error('Error loading character:', err);
      clear();
    }
  };

  const handleSaveCharacter = async () => {
    if (!selectedCharacter || strokes.length === 0) {
      toast({ title: "Cannot Save", description: "Draw the character first before saving.", variant: "destructive" });
      return;
    }

    try {
      const vectorPaths = strokes.map(stroke => {
        const points = stroke.points;
        if (points.length === 0) return '';
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          path += ` L ${points[i].x} ${points[i].y}`;
        }
        return path;
      });

      const normalizedBezier = strokes.map(stroke => ({
        points: stroke.points.map(p => ({
          x: p.x / 500, y: p.y / 300, pressure: p.pressure,
        })),
        color: stroke.color, width: stroke.width,
      }));

      const { data: existing } = await supabase
        .from('font_library').select('id').eq('character', selectedCharacter).single();

      if (existing) {
        const { error } = await supabase.from('font_library').update({
          vector_paths: vectorPaths, normalized_bezier: normalizedBezier,
          mean_slant_angle: metrics.slantAngle, pressure_variance: metrics.pressureVariance,
          stroke_count: metrics.strokeCount, updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('font_library').insert({
          character: selectedCharacter, display_name: `Character ${selectedCharacter}`,
          vector_paths: vectorPaths, normalized_bezier: normalizedBezier,
          mean_slant_angle: metrics.slantAngle, pressure_variance: metrics.pressureVariance,
          stroke_count: metrics.strokeCount,
        });
        if (error) throw error;
      }

      toast({ title: "Character Saved", description: `"${selectedCharacter}" has been saved to your font library.` });
      clear();

      const allChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');
      const currentIndex = allChars.indexOf(selectedCharacter);
      if (currentIndex < allChars.length - 1) {
        setSelectedCharacter(allChars[currentIndex + 1]);
      } else {
        setSelectedCharacter(null);
      }
    } catch (error) {
      console.error('Error saving character:', error);
      toast({ title: "Save Failed", description: "Could not save character. Please try again.", variant: "destructive" });
    }
  };

  const handleRecordLigature = (pair: string) => {
    clear();
    setSelectedCharacter(pair);
  };

  const handleExportFont = async () => {
    setIsExporting(true);
    try {
      const { count, error: countError } = await supabase
        .from('font_library').select('*', { count: 'exact', head: true });
      if (countError) throw countError;
      if (!count || count === 0) {
        toast({ title: "No Characters Recorded", description: "Please draw and save at least a few characters before exporting a font.", variant: "destructive" });
        setIsExporting(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/compile-font`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey },
        body: JSON.stringify({ metadata: fontMetadata }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errBody.message || errBody.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fontMetadata.fontName.replace(/\s+/g, '-')}.ttf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Font Exported", description: `Your handwriting font "${fontMetadata.fontName}" has been downloaded as a TTF file.` });
    } catch (error) {
      console.error('Error exporting font:', error);
      toast({ title: "Export Failed", description: error instanceof Error ? error.message : "Could not compile font. Please try again later.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOutOfBounds = () => {
    const now = Date.now();
    if (now - lastOutOfBoundsToastAtRef.current < 1500) return;
    lastOutOfBoundsToastAtRef.current = now;
    const t = toast({ title: "Stay Within Lines", description: "Write between the guide lines for consistent font metrics.", variant: "destructive" });
    window.setTimeout(() => { t.dismiss(); }, 1600);
  };

  // Compute overlay text for trace mode
  const overlayText = mode === 'trace' && activeFont
    ? (wordMode ? wordText : (selectedCharacter || ''))
    : undefined;

  const overlayFontFamily = mode === 'trace' && activeFont
    ? `uploaded-${activeFont.id}`
    : undefined;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold text-foreground">System Font Compiler</h1>
              <p className="text-xs text-muted-foreground">Create Your Custom Handwriting Font</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center bg-secondary/50 rounded-lg p-0.5">
              <button
                onClick={() => { setMode('build'); clear(); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  mode === 'build' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <PenTool className="w-3.5 h-3.5" />
                Build
              </button>
              <button
                onClick={() => { setMode('trace'); clear(); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  mode === 'trace' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Type className="w-3.5 h-3.5" />
                Trace
              </button>
            </div>

            <Button
              onClick={handleExportFont}
              disabled={isExporting}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {isExporting ? <>Compiling...</> : <><Download className="w-4 h-4 mr-2" />Export Font</>}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: Character Grid & extras */}
          <div className="xl:col-span-4 space-y-4">
            {mode === 'trace' && (
              <FontUploadPanel activeFont={activeFont} onFontSelect={setActiveFont} />
            )}

            {/* Word mode toggle (trace only) */}
            {mode === 'trace' && activeFont && (
              <div className="panel-glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wordMode}
                      onChange={(e) => { setWordMode(e.target.checked); if (!e.target.checked) setWordText(''); }}
                      className="rounded border-border"
                    />
                    <span className="text-xs font-medium text-foreground">Word / Sentence Mode</span>
                  </label>
                </div>
                {wordMode && (
                  <Input
                    placeholder="Type a word or sentence to trace…"
                    value={wordText}
                    onChange={(e) => setWordText(e.target.value)}
                    className="text-sm"
                  />
                )}

                {/* Overlay Opacity */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Overlay Opacity: {Math.round(overlayOpacity * 100)}%
                  </label>
                  <Slider
                    min={5}
                    max={80}
                    step={1}
                    value={[Math.round(overlayOpacity * 100)]}
                    onValueChange={([v]) => setOverlayOpacity(v / 100)}
                  />
                </div>

                {/* Overlay Color */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Overlay Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={overlayColor}
                      onChange={(e) => setOverlayColor(e.target.value)}
                      className="w-8 h-8 rounded border border-border cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">{overlayColor}</span>
                  </div>
                </div>
              </div>
            )}

            <CharacterGrid 
              onSelectCharacter={handleSelectCharacter}
              selectedCharacter={selectedCharacter}
            />
            {mode === 'build' && <LigatureEngine onRecordLigature={handleRecordLigature} />}
          </div>

          {/* Center: Canvas */}
          <div className="xl:col-span-5 space-y-4">
            <CanvasToolbar
              config={toolbarConfig}
              onConfigChange={handleConfigChange}
              onUndo={undo}
              onRedo={redo}
              onClear={clear}
              canUndo={canUndo}
              canRedo={canRedo}
              onFlipAll={flipAll}
              onRotateAll={rotateAll}
            />

            <div className="h-[350px]">
              <FourLineCanvas
                strokes={strokes}
                currentStroke={currentStroke}
                penColor={toolbarConfig.penColor}
                brushWidth={toolbarConfig.brushWidth}
                activeTool={toolbarConfig.activeTool}
                targetCharacter={selectedCharacter}
                overlayText={overlayText}
                overlayFontFamily={overlayFontFamily}
                overlayOpacity={overlayOpacity}
                overlayColor={overlayColor}
                onStartStroke={startStroke}
                onContinueStroke={continueStroke}
                onEndStroke={handleEndStroke}
                onReplaceLastStroke={replaceLastStroke}
                onEraseAtPoint={eraseAtPoint}
                onStartErase={startErase}
                onEndErase={endErase}
                onAddStamp={addStamp}
                onMoveStrokes={moveStrokes}
                onScaleStrokes={scaleStrokes}
                onChangeStrokeWidth={changeStrokeWidth}
                onResizeStrokes={resizeStrokes}
                onFlipStrokes={flipStrokes}
                onRotateStrokes={rotateStrokes}
                onOutOfBounds={handleOutOfBounds}
                onCanvasSizeChange={setCanvasHeight}
              />
            </div>

            <StrokeValidationFeedback
              metrics={validationMetrics}
              hasStrokes={strokes.length > 0 || currentStroke.length > 0}
            />

            {/* Save Button */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSaveCharacter}
                disabled={!selectedCharacter || strokes.length === 0}
                className="flex-1 bg-gradient-to-r from-success to-accent hover:opacity-90"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Save "{wordMode && wordText ? wordText : (selectedCharacter || '?')}" to Font Library
              </Button>
              <Button onClick={clear} variant="outline" disabled={strokes.length === 0}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>

            {/* Tracing Session Recorder (trace mode only) */}
            {mode === 'trace' && strokes.length > 0 && (
              <TracingSessionRecorder
                strokes={strokes}
                character={wordMode ? wordText : selectedCharacter}
              />
            )}

            {/* Live Type Tester */}
            <LiveTypeTester
              metadata={fontMetadata}
              onExportFont={handleExportFont}
              isExporting={isExporting}
            />
          </div>

          {/* Right: Metadata Config */}
          <div className="xl:col-span-3">
            <FontMetadataConfig
              metadata={fontMetadata}
              onMetadataChange={setFontMetadata}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default FontCompiler;
