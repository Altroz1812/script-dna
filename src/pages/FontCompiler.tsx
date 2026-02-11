import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Wand2, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CharacterGrid } from '@/components/handwriting/CharacterGrid';
import { FourLineCanvas } from '@/components/handwriting/FourLineCanvas';
import { FontMetadataConfig, FontMetadata } from '@/components/handwriting/FontMetadataConfig';
import { LiveTypeTester } from '@/components/handwriting/LiveTypeTester';
import { LigatureEngine } from '@/components/handwriting/LigatureEngine';
import { CanvasToolbar } from '@/components/handwriting/CanvasToolbar';
import { StrokeValidationFeedback } from '@/components/handwriting/StrokeValidationFeedback';
import { useStrokeCapture } from '@/hooks/useStrokeCapture';
import { useStrokeValidator } from '@/hooks/useStrokeValidator';
import { ToolbarConfig } from '@/types/handwriting';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const FontCompiler = () => {
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

  const {
    strokes,
    currentStroke,
    metrics,
    startStroke,
    continueStroke,
    endStroke,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    replaceLastStroke,
    eraseAtPoint,
    startErase,
    endErase,
    addStamp,
    moveStrokes,
    scaleStrokes,
    changeStrokeWidth,
  } = useStrokeCapture();

  const lastOutOfBoundsToastAtRef = useRef<number>(0);

  // Real-time stroke validation
  const validationMetrics = useStrokeValidator({
    strokes,
    currentStroke,
    canvasHeight,
  });

  const handleConfigChange = useCallback((config: Partial<ToolbarConfig>) => {
    setToolbarConfig(prev => ({ ...prev, ...config }));
  }, []);

  const handleEndStroke = useCallback(() => {
    endStroke(toolbarConfig.penColor, toolbarConfig.brushWidth);
  }, [endStroke, toolbarConfig.penColor, toolbarConfig.brushWidth]);

  const handleSelectCharacter = (char: string) => {
    clear();
    setSelectedCharacter(char);
  };

  const handleSaveCharacter = async () => {
    if (!selectedCharacter || strokes.length === 0) {
      toast({
        title: "Cannot Save",
        description: "Draw the character first before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Convert strokes to vector paths
      const vectorPaths = strokes.map(stroke => {
        const points = stroke.points;
        if (points.length === 0) return '';
        
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          path += ` L ${points[i].x} ${points[i].y}`;
        }
        return path;
      });

      // Normalize bezier paths
      const normalizedBezier = strokes.map(stroke => ({
        points: stroke.points.map(p => ({
          x: p.x / 500,
          y: p.y / 300,
          pressure: p.pressure,
        })),
        color: stroke.color,
        width: stroke.width,
      }));

      // Check if character exists, update or insert
      const { data: existing } = await supabase
        .from('font_library')
        .select('id')
        .eq('character', selectedCharacter)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('font_library')
          .update({
            vector_paths: vectorPaths,
            normalized_bezier: normalizedBezier,
            mean_slant_angle: metrics.slantAngle,
            pressure_variance: metrics.pressureVariance,
            stroke_count: metrics.strokeCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('font_library')
          .insert({
            character: selectedCharacter,
            display_name: `Character ${selectedCharacter}`,
            vector_paths: vectorPaths,
            normalized_bezier: normalizedBezier,
            mean_slant_angle: metrics.slantAngle,
            pressure_variance: metrics.pressureVariance,
            stroke_count: metrics.strokeCount,
          });

        if (error) throw error;
      }

      toast({
        title: "Character Saved",
        description: `"${selectedCharacter}" has been saved to your font library.`,
      });

      clear();
      
      // Find next unrecorded character
      const allChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');
      const currentIndex = allChars.indexOf(selectedCharacter);
      if (currentIndex < allChars.length - 1) {
        setSelectedCharacter(allChars[currentIndex + 1]);
      } else {
        setSelectedCharacter(null);
      }

    } catch (error) {
      console.error('Error saving character:', error);
      toast({
        title: "Save Failed",
        description: "Could not save character. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRecordLigature = (pair: string) => {
    clear();
    setSelectedCharacter(pair);
  };

  const handleExportFont = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('compile-font', {
        body: { metadata: fontMetadata },
      });

      if (error) throw error;

      // The response is the raw TTF binary
      let blob: Blob;
      if (data instanceof Blob) {
        blob = data;
      } else if (data instanceof ArrayBuffer) {
        blob = new Blob([data], { type: 'font/ttf' });
      } else {
        // If it returned JSON with an error message
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsed?.error) throw new Error(parsed.message || parsed.error);
        throw new Error('Unexpected response format');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fontMetadata.fontName.replace(/\s+/g, '-')}.ttf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Font Exported",
        description: `Your handwriting font "${fontMetadata.fontName}" has been downloaded as a TTF file.`,
      });
    } catch (error) {
      console.error('Error exporting font:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Could not compile font. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleOutOfBounds = () => {
    // Prevent toast spam during pointer jitter; also auto-dismiss quickly
    const now = Date.now();
    if (now - lastOutOfBoundsToastAtRef.current < 1500) return;
    lastOutOfBoundsToastAtRef.current = now;

    const t = toast({
      title: "Stay Within Lines",
      description: "Write between the guide lines for consistent font metrics.",
      variant: "destructive",
    });

    window.setTimeout(() => {
      t.dismiss();
    }, 1600);
  };

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
            <Button
              onClick={handleExportFont}
              disabled={isExporting}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {isExporting ? (
                <>Compiling...</>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Font
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: Character Grid & Ligatures */}
          <div className="xl:col-span-4 space-y-4">
            <CharacterGrid 
              onSelectCharacter={handleSelectCharacter}
              selectedCharacter={selectedCharacter}
            />
            <LigatureEngine onRecordLigature={handleRecordLigature} />
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
            />

            <div className="h-[350px]">
              <FourLineCanvas
                strokes={strokes}
                currentStroke={currentStroke}
                penColor={toolbarConfig.penColor}
                brushWidth={toolbarConfig.brushWidth}
                activeTool={toolbarConfig.activeTool}
                targetCharacter={selectedCharacter}
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
                onOutOfBounds={handleOutOfBounds}
                onCanvasSizeChange={setCanvasHeight}
              />
            </div>

            {/* Real-time Validation Feedback */}
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
                Save "{selectedCharacter || '?'}" to Font Library
              </Button>
              <Button
                onClick={clear}
                variant="outline"
                disabled={strokes.length === 0}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>

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
