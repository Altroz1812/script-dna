import { useEffect, useState } from 'react';
import { Library, Trash2, Eye, Loader2, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { StrokeReplayCanvas } from './StrokeReplayCanvas';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface NormalizedStroke {
  points: StrokePoint[];
  color: string;
  width: number;
}

interface FontCharacter {
  id: string;
  character: string;
  display_name: string | null;
  vector_paths: string[];
  normalized_bezier: NormalizedStroke[];
  mean_slant_angle: number | null;
  pressure_variance: number | null;
  stroke_count: number | null;
  created_at: string | null;
}

export function FontLibrary() {
  const [characters, setCharacters] = useState<FontCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<FontCharacter | null>(null);

  const fetchCharacters = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('font_library')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Parse vector_paths and normalized_bezier from JSON
      const parsed = (data || []).map((item) => ({
        ...item,
        vector_paths: Array.isArray(item.vector_paths) 
          ? item.vector_paths as string[]
          : [],
        normalized_bezier: Array.isArray(item.normalized_bezier)
          ? (item.normalized_bezier as unknown as NormalizedStroke[])
          : [],
      }));

      setCharacters(parsed);
    } catch (error) {
      console.error('Error fetching characters:', error);
      toast({
        title: 'Error',
        description: 'Failed to load font library.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('font_library')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCharacters((prev) => prev.filter((c) => c.id !== id));
      if (selectedCharacter?.id === id) {
        setSelectedCharacter(null);
      }

      toast({
        title: 'Character Deleted',
        description: 'The character has been removed from your font library.',
      });
    } catch (error) {
      console.error('Error deleting character:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete character. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const renderStrokePreview = (vectorPaths: string[], size: number = 80) => {
    if (!vectorPaths || vectorPaths.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
          No strokes
        </div>
      );
    }

    return (
      <svg
        viewBox="0 0 500 400"
        width={size}
        height={size * 0.8}
        className="stroke-primary"
        style={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}
      >
        {vectorPaths.map((path, idx) => (
          <path
            key={idx}
            d={path}
            fill="none"
            strokeWidth="3"
            className="stroke-primary"
          />
        ))}
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div className="panel-glass p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Loading font library...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Character Grid */}
      <div className="lg:col-span-8">
        <div className="panel-glass p-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border/50 mb-4">
            <Library className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              Font Library
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {characters.length} character{characters.length !== 1 ? 's' : ''}
            </span>
          </div>

          {characters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Library className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">No characters saved yet</p>
              <p className="text-xs mt-1">
                Use the Pattern Recorder to train characters
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pr-4">
                {characters.map((char) => (
                  <Card
                    key={char.id}
                    className={`p-3 cursor-pointer transition-all hover:border-primary/50 bg-secondary/30 border-border/50 ${
                      selectedCharacter?.id === char.id
                        ? 'border-primary ring-1 ring-primary/30'
                        : ''
                    }`}
                    onClick={() => setSelectedCharacter(char)}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-full aspect-square bg-background/50 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                        {renderStrokePreview(char.vector_paths)}
                      </div>
                      <div className="text-2xl font-mono font-bold text-foreground">
                        {char.character}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate w-full text-center">
                        {char.display_name || 'Untitled'}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Character Detail Panel */}
      <div className="lg:col-span-4">
        <div className="panel-glass p-4 sticky top-20">
          <div className="flex items-center gap-2 pb-3 border-b border-border/50 mb-4">
            <Eye className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              Character Details
            </h3>
          </div>

          {selectedCharacter ? (
            <div className="space-y-4">
              {/* Large Preview */}
              <div className="aspect-video bg-background/50 rounded-lg flex items-center justify-center border border-border/50">
                {renderStrokePreview(selectedCharacter.vector_paths, 200)}
              </div>

              {/* Character Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Character
                  </span>
                  <span className="text-3xl font-mono font-bold text-foreground">
                    {selectedCharacter.character}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Display Name
                  </span>
                  <span className="text-sm text-foreground">
                    {selectedCharacter.display_name || '—'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center p-2 bg-secondary/30 rounded-lg">
                    <div className="text-lg font-mono font-bold text-foreground">
                      {selectedCharacter.stroke_count ?? 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Strokes
                    </div>
                  </div>
                  <div className="text-center p-2 bg-secondary/30 rounded-lg">
                    <div className="text-lg font-mono font-bold text-foreground">
                      {selectedCharacter.mean_slant_angle?.toFixed(1) ?? '—'}°
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Slant
                    </div>
                  </div>
                  <div className="text-center p-2 bg-secondary/30 rounded-lg">
                    <div className="text-lg font-mono font-bold text-foreground">
                      {selectedCharacter.pressure_variance?.toFixed(2) ?? '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      P.Var
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-2">
                  Created:{' '}
                  {selectedCharacter.created_at
                    ? new Date(selectedCharacter.created_at).toLocaleDateString()
                    : '—'}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border/50 space-y-2">
                {/* Replay Button */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-primary to-accent"
                      disabled={!selectedCharacter.normalized_bezier || selectedCharacter.normalized_bezier.length === 0}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Replay Writing
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Play className="w-5 h-5 text-accent" />
                        Stroke Replay: "{selectedCharacter.character}"
                      </DialogTitle>
                    </DialogHeader>
                    <StrokeReplayCanvas
                      normalizedBezier={selectedCharacter.normalized_bezier}
                      canvasWidth={450}
                      canvasHeight={360}
                    />
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Character
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Character?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove "{selectedCharacter.character}" 
                        from your font library. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(selectedCharacter.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Eye className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-sm">Select a character</p>
              <p className="text-xs mt-1">to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
