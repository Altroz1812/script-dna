import { useState } from 'react';
import { Save, Check, X, Type } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StrokeData, LiveMetrics } from '@/types/handwriting';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CharacterTrainingProps {
  strokes: StrokeData[];
  metrics: LiveMetrics;
  onSave: () => void;
}

export function CharacterTraining({ strokes, metrics, onSave }: CharacterTrainingProps) {
  const [character, setCharacter] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!character || strokes.length === 0) {
      toast({
        title: "Cannot Save",
        description: "Please write a character and draw at least one stroke.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Convert strokes to vector paths (simplified SVG path format)
      const vectorPaths = strokes.map(stroke => {
        const points = stroke.points;
        if (points.length === 0) return '';
        
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          path += ` L ${points[i].x} ${points[i].y}`;
        }
        return path;
      });

      // Normalize bezier paths (simplified)
      const normalizedBezier = strokes.map(stroke => ({
        points: stroke.points.map(p => ({
          x: p.x / 500, // Normalize to 0-1 range
          y: p.y / 400,
          pressure: p.pressure,
        })),
        color: stroke.color,
        width: stroke.width,
      }));

      // Insert into font_library
      const { data: fontData, error: fontError } = await supabase
        .from('font_library')
        .insert({
          character,
          display_name: displayName || `Character ${character}`,
          vector_paths: vectorPaths,
          normalized_bezier: normalizedBezier,
          mean_slant_angle: metrics.slantAngle,
          pressure_variance: metrics.pressureVariance,
          stroke_count: metrics.strokeCount,
        })
        .select()
        .single();

      if (fontError) throw fontError;

      // Insert stroke recordings
      const strokeRecords = strokes.map(stroke => ({
        font_library_id: fontData.id,
        stroke_data: JSON.parse(JSON.stringify(stroke.points)),
        duration_ms: Math.round(stroke.endTime - stroke.startTime),
        avg_pressure: stroke.points.reduce((sum, p) => sum + p.pressure, 0) / stroke.points.length,
        avg_velocity: stroke.points.reduce((sum, p) => sum + p.velocity, 0) / stroke.points.length,
        slant_angle: metrics.slantAngle,
      }));

      const { error: strokeError } = await supabase
        .from('stroke_recordings')
        .insert(strokeRecords);

      if (strokeError) throw strokeError;

      toast({
        title: "Character Saved",
        description: `"${character}" has been added to your font library.`,
      });

      setCharacter('');
      setDisplayName('');
      onSave();
    } catch (error) {
      console.error('Error saving character:', error);
      toast({
        title: "Save Failed",
        description: "Could not save character. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="panel-glass p-4 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border/50">
        <Type className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Character Training</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Character
          </label>
          <Input
            value={character}
            onChange={(e) => {
              const value = e.target.value;
              // Only allow uppercase and lowercase letters (A-Z, a-z)
              const filtered = value.replace(/[^a-zA-Z]/g, '').slice(0, 1);
              setCharacter(filtered);
            }}
            placeholder="A"
            className="mt-1.5 text-center text-2xl font-mono h-14 bg-secondary/50 border-border/50"
            maxLength={1}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Only A-Z, a-z allowed</p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Display Name (Optional)
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Uppercase A"
            className="mt-1.5 bg-secondary/50 border-border/50"
          />
        </div>

        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={!character || strokes.length === 0 || isSaving}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save to Font Library
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/50">
        <div className="text-center p-2 bg-secondary/30 rounded-lg">
          <div className="text-lg font-mono font-bold text-foreground">{strokes.length}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Strokes</div>
        </div>
        <div className="text-center p-2 bg-secondary/30 rounded-lg">
          <div className="text-lg font-mono font-bold text-foreground">{metrics.totalPoints}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Data Points</div>
        </div>
      </div>
    </div>
  );
}
