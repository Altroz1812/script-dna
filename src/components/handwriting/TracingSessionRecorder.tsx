import { useState, useCallback } from 'react';
import { Save, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StrokeReplayCanvas } from './StrokeReplayCanvas';
import { StrokeData } from '@/types/handwriting';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface TracingSessionRecorderProps {
  strokes: StrokeData[];
  character: string | null;
  fontLibraryId?: string;
}

export function TracingSessionRecorder({
  strokes,
  character,
  fontLibraryId,
}: TracingSessionRecorderProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Convert strokes to normalized bezier for replay
  const normalizedBezier = strokes.map(stroke => ({
    points: stroke.points.map(p => ({
      x: p.x / 500,
      y: p.y / 300,
      pressure: p.pressure,
    })),
    color: stroke.color,
    width: stroke.width,
  }));

  const handleSaveRecording = useCallback(async () => {
    if (strokes.length === 0) return;
    setIsSaving(true);

    try {
      const allPoints = strokes.flatMap(s => s.points);
      const avgPressure = allPoints.reduce((sum, p) => sum + p.pressure, 0) / allPoints.length;
      const avgVelocity = allPoints.reduce((sum, p) => sum + (p.velocity || 0), 0) / allPoints.length;
      const durationMs = allPoints.length > 1
        ? allPoints[allPoints.length - 1].timestamp - allPoints[0].timestamp
        : 0;

      const { error } = await supabase
        .from('stroke_recordings')
        .insert({
          font_library_id: fontLibraryId || null,
          stroke_data: normalizedBezier,
          duration_ms: Math.round(durationMs),
          avg_pressure: avgPressure,
          avg_velocity: avgVelocity,
        });

      if (error) throw error;

      toast({
        title: 'Recording Saved',
        description: `Tracing session for "${character || '?'}" saved successfully.`,
      });
    } catch (err) {
      console.error('Save recording error:', err);
      toast({
        title: 'Save Failed',
        description: 'Could not save recording.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [strokes, character, fontLibraryId, normalizedBezier]);

  if (strokes.length === 0) return null;

  return (
    <div className="panel-glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          Session Replay & Recording
        </h3>
        <Button
          size="sm"
          onClick={handleSaveRecording}
          disabled={isSaving}
          className="bg-gradient-to-r from-primary to-accent"
        >
          <Save className="w-4 h-4 mr-1" />
          {isSaving ? 'Saving...' : 'Save Recording'}
        </Button>
      </div>

      <StrokeReplayCanvas
        normalizedBezier={normalizedBezier}
        canvasWidth={500}
        canvasHeight={300}
      />
    </div>
  );
}
