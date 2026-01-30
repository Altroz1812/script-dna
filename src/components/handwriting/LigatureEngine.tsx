import { useState, useEffect } from 'react';
import { Link2, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Ligature {
  id: string;
  pair: string;
  recorded: boolean;
}

const COMMON_LIGATURES = [
  'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd',
  'ti', 'es', 'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar',
  'st', 'to', 'nt', 'ng', 'se', 'ha', 'as', 'ou', 'io', 'le',
  'ff', 'fi', 'fl', 'tt', 'ss', 'ee', 'oo', 'ing', 'tion', 'and',
];

interface LigatureEngineProps {
  onRecordLigature: (pair: string) => void;
}

export function LigatureEngine({ onRecordLigature }: LigatureEngineProps) {
  const [ligatures, setLigatures] = useState<Ligature[]>([]);
  const [customPair, setCustomPair] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRecordedLigatures();
  }, []);

  const fetchRecordedLigatures = async () => {
    try {
      // Check which ligatures are already recorded
      const { data, error } = await supabase
        .from('font_library')
        .select('character')
        .like('character', '__%'); // Characters with 2+ chars are ligatures

      if (error) throw error;

      const recordedPairs = new Set(data?.map(item => item.character) || []);
      
      const allLigatures = COMMON_LIGATURES.map(pair => ({
        id: pair,
        pair,
        recorded: recordedPairs.has(pair),
      }));

      setLigatures(allLigatures);
    } catch (error) {
      console.error('Error fetching ligatures:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustom = () => {
    if (customPair.length < 2) {
      toast({
        title: "Invalid Ligature",
        description: "Ligatures must be at least 2 characters.",
        variant: "destructive",
      });
      return;
    }

    if (ligatures.some(l => l.pair === customPair)) {
      toast({
        title: "Already Exists",
        description: "This ligature pair already exists.",
        variant: "destructive",
      });
      return;
    }

    setLigatures(prev => [...prev, {
      id: customPair,
      pair: customPair,
      recorded: false,
    }]);
    setCustomPair('');
  };

  const handleRemove = (pair: string) => {
    setLigatures(prev => prev.filter(l => l.pair !== pair));
  };

  const recordedCount = ligatures.filter(l => l.recorded).length;
  const progress = Math.round((recordedCount / ligatures.length) * 100);

  return (
    <div className="panel-glass p-4 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">Ligature Engine</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{recordedCount}/{ligatures.length}</span>
          <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Why Ligatures Matter</p>
          <p>Ligatures are connected letter pairs that make handwriting look natural. 
          Recording common pairs like "th" and "ing" ensures your font flows smoothly.</p>
        </div>
      </div>

      {/* Add Custom */}
      <div className="flex items-center gap-2">
        <Input
          value={customPair}
          onChange={(e) => setCustomPair(e.target.value.toLowerCase())}
          placeholder="Add custom pair..."
          className="bg-secondary/50 border-border/50"
          maxLength={5}
        />
        <Button
          onClick={handleAddCustom}
          variant="outline"
          size="icon"
          disabled={customPair.length < 2}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Ligature Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse text-muted-foreground">Loading ligatures...</div>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-2">
          {ligatures.map((ligature) => (
            <button
              key={ligature.id}
              onClick={() => onRecordLigature(ligature.pair)}
              className={cn(
                "group relative px-3 py-2 rounded-lg font-mono text-sm transition-all duration-200",
                "border flex items-center justify-center",
                ligature.recorded
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-secondary/50 border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-primary/30"
              )}
            >
              {ligature.pair}
              {ligature.recorded && (
                <Check className="absolute -top-1 -right-1 w-3 h-3 bg-success text-background rounded-full p-0.5" />
              )}
              {!COMMON_LIGATURES.includes(ligature.pair) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(ligature.pair);
                  }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="pt-3 border-t border-border/50">
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Recording Tips</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Write pairs as you would naturally connect them</li>
            <li>Record the same pair 3-5 times for best results</li>
            <li>Focus on commonly used pairs first</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
