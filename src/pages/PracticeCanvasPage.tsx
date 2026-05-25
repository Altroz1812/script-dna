import { useCallback, useState } from 'react';
import { ArrowLeft, Sparkles, Type as TypeIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { CharacterGrid } from '@/components/handwriting/CharacterGrid';
import { FourLineCanvas } from '@/components/handwriting/FourLineCanvas';
import { CanvasToolbar } from '@/components/handwriting/CanvasToolbar';
import { FontUploadPanel, UploadedFont } from '@/components/handwriting/FontUploadPanel';
import { useStrokeCapture } from '@/hooks/useStrokeCapture';
import { ToolbarConfig } from '@/types/handwriting';
import { useIsMobileApp } from '@/hooks/useIsMobileApp';
import { cn } from '@/lib/utils';

/**
 * Student-only practice canvas.
 * Re-uses the FontCompiler trace experience without any save/export/governance.
 * Students pick a character (or type a word), optionally trace over an uploaded
 * font, and freely practice. Nothing is persisted.
 */
export default function PracticeCanvasPage() {
  const isMobile = useIsMobileApp();
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>('a');
  const [wordMode, setWordMode] = useState(false);
  const [wordText, setWordText] = useState('');
  const [activeFont, setActiveFont] = useState<UploadedFont | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.25);
  const [toolbarConfig, setToolbarConfig] = useState<ToolbarConfig>({
    brushWidth: 4,
    penColor: '#3b82f6',
    overlay: 'none',
    activeTool: 'pen',
  });

  const {
    strokes, currentStroke,
    startStroke, continueStroke, endStroke,
    undo, redo, canUndo, canRedo, clear,
    replaceLastStroke, eraseAtPoint, startErase, endErase, addStamp,
    moveStrokes, scaleStrokes, changeStrokeWidth, resizeStrokes,
    flipStrokes, rotateStrokes, flipAll, rotateAll,
  } = useStrokeCapture();

  const handleConfigChange = useCallback((c: Partial<ToolbarConfig>) => {
    setToolbarConfig(prev => ({ ...prev, ...c }));
  }, []);

  const handleEndStroke = useCallback(() => {
    endStroke(toolbarConfig.penColor, toolbarConfig.brushWidth);
  }, [endStroke, toolbarConfig.penColor, toolbarConfig.brushWidth]);

  const handleSelectCharacter = (char: string) => {
    setSelectedCharacter(char);
    clear();
  };

  const overlayText = activeFont
    ? (wordMode ? wordText : (selectedCharacter || ''))
    : undefined;
  const overlayFontFamily = activeFont ? `uploaded-${activeFont.id}` : undefined;

  return (
    <div className={cn('min-h-screen bg-background', isMobile ? 'pb-24' : 'pb-10')}>
      {!isMobile && (
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 h-16 flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground">Practice Canvas</h1>
                <p className="text-xs text-muted-foreground">Trace, write, and improve your handwriting</p>
              </div>
            </div>
          </div>
        </header>
      )}

      {isMobile && (
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <div className="text-base font-semibold font-display">Practice Canvas</div>
            <div className="text-[11px] text-muted-foreground">Trace & write</div>
          </div>
        </div>
      )}

      <main className={cn('mx-auto', isMobile ? 'px-3 py-3 space-y-3' : 'container px-4 py-6')}>
        <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-12 gap-6')}>
          {/* Left: trace font + character picker */}
          <div className={cn('space-y-3', !isMobile && 'xl:col-span-4 space-y-4')}>
            <FontUploadPanel activeFont={activeFont} onFontSelect={setActiveFont} />

            {activeFont && (
              <div className="panel-glass rounded-xl p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wordMode}
                    onChange={(e) => { setWordMode(e.target.checked); if (!e.target.checked) setWordText(''); }}
                    className="rounded border-border"
                  />
                  <TypeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Word / Sentence Mode</span>
                </label>
                {wordMode && (
                  <Input
                    placeholder="Type a word to trace…"
                    value={wordText}
                    onChange={(e) => setWordText(e.target.value)}
                    className="text-sm"
                  />
                )}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Trace Opacity: {Math.round(overlayOpacity * 100)}%
                  </label>
                  <Slider
                    min={5} max={80} step={1}
                    value={[Math.round(overlayOpacity * 100)]}
                    onValueChange={([v]) => setOverlayOpacity(v / 100)}
                  />
                </div>
              </div>
            )}

            <CharacterGrid
              onSelectCharacter={handleSelectCharacter}
              selectedCharacter={selectedCharacter}
            />
          </div>

          {/* Right: canvas */}
          <div className={cn('space-y-3', !isMobile && 'xl:col-span-8 space-y-4')}>
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

            <div className={cn(isMobile ? 'h-[55vh] min-h-[320px]' : 'h-[460px]')}>
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
              />
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Pick a letter, optionally choose a font to trace over it, and start writing. Nothing is saved — practice as much as you like.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}