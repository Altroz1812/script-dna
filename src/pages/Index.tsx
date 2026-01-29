import { useState, useCallback } from 'react';
import { PenTool, Database, BarChart3, Settings, Library } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CanvasNotepad } from '@/components/handwriting/CanvasNotepad';
import { CanvasToolbar } from '@/components/handwriting/CanvasToolbar';
import { LiveMetricsPanel } from '@/components/handwriting/LiveMetricsPanel';
import { CharacterTraining } from '@/components/handwriting/CharacterTraining';
import { DiscoveryAgent } from '@/components/handwriting/DiscoveryAgent';
import { RuleGovernance } from '@/components/handwriting/RuleGovernance';
import { FontLibrary } from '@/components/handwriting/FontLibrary';
import { useStrokeCapture } from '@/hooks/useStrokeCapture';
import { ToolbarConfig, OverlayType } from '@/types/handwriting';

const Index = () => {
  const [toolbarConfig, setToolbarConfig] = useState<ToolbarConfig>({
    brushWidth: 3,
    penColor: '#3b82f6',
    overlay: 'lines',
  });

  const [undoStack, setUndoStack] = useState<string[]>([]);

  const {
    strokes,
    currentStroke,
    isDrawing,
    metrics,
    startStroke,
    continueStroke,
    endStroke,
    undo,
    clear,
  } = useStrokeCapture();

  const handleConfigChange = useCallback((config: Partial<ToolbarConfig>) => {
    setToolbarConfig(prev => ({ ...prev, ...config }));
  }, []);

  const handleEndStroke = useCallback(() => {
    endStroke(toolbarConfig.penColor, toolbarConfig.brushWidth);
  }, [endStroke, toolbarConfig.penColor, toolbarConfig.brushWidth]);

  const handleClear = useCallback(() => {
    clear();
  }, [clear]);

  const handleCharacterSaved = useCallback(() => {
    clear();
  }, [clear]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <PenTool className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Font Architect</h1>
              <p className="text-xs text-muted-foreground">Enterprise Pattern Recorder</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              Admin
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="recorder" className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border/50 p-1">
            <TabsTrigger value="recorder" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <PenTool className="w-4 h-4 mr-2" />
              Pattern Recorder
            </TabsTrigger>
            <TabsTrigger value="governance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Rule Governance
            </TabsTrigger>
            <TabsTrigger value="library" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Library className="w-4 h-4 mr-2" />
              Font Library
            </TabsTrigger>
          </TabsList>

          {/* Pattern Recorder Tab */}
          <TabsContent value="recorder" className="space-y-4">
            {/* Toolbar */}
            <CanvasToolbar
              config={toolbarConfig}
              onConfigChange={handleConfigChange}
              onUndo={undo}
              onRedo={() => {}}
              onClear={handleClear}
              canUndo={strokes.length > 0}
              canRedo={undoStack.length > 0}
            />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Canvas Area */}
              <div className="lg:col-span-8 space-y-4">
                <div className="h-[500px]">
                  <CanvasNotepad
                    strokes={strokes}
                    currentStroke={currentStroke}
                    penColor={toolbarConfig.penColor}
                    brushWidth={toolbarConfig.brushWidth}
                    overlay={toolbarConfig.overlay}
                    onStartStroke={startStroke}
                    onContinueStroke={continueStroke}
                    onEndStroke={handleEndStroke}
                  />
                </div>

                {/* Character Training */}
                <CharacterTraining
                  strokes={strokes}
                  metrics={metrics}
                  onSave={handleCharacterSaved}
                />
              </div>

              {/* Right Sidebar */}
              <div className="lg:col-span-4 space-y-4">
                <LiveMetricsPanel metrics={metrics} />
                <DiscoveryAgent metrics={metrics} />
              </div>
            </div>
          </TabsContent>

          {/* Rule Governance Tab */}
          <TabsContent value="governance">
            <RuleGovernance />
          </TabsContent>

          {/* Font Library Tab */}
          <TabsContent value="library">
            <FontLibrary />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer Stats */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-10 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              Cloud Connected
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              {metrics.totalPoints} data points captured
            </span>
          </div>
          <div className="font-mono">
            v1.0.0 • Enterprise Edition
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
