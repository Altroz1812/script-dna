import { useState, useEffect } from 'react';
import { Check, Circle, Grid } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CharacterGridProps {
  onSelectCharacter: (char: string) => void;
  selectedCharacter: string | null;
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'.split('');
const NUMBERS = '0123456789'.split('');
const PUNCTUATION = '.,;:!?\'"()-@#$%&'.split('');
const SYMBOLS = ['/','\\','+','=','<','>','[',']','{','}','|','~','^','_','*'];

export function CharacterGrid({ onSelectCharacter, selectedCharacter }: CharacterGridProps) {
  const [recordedChars, setRecordedChars] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRecordedCharacters();
  }, []);

  const fetchRecordedCharacters = async () => {
    try {
      const { data, error } = await supabase
        .from('font_library')
        .select('character');
      
      if (error) throw error;
      
      const chars = new Set(data?.map(item => item.character) || []);
      setRecordedChars(chars);
    } catch (error) {
      console.error('Error fetching recorded characters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderCharacterButton = (char: string) => {
    const isRecorded = recordedChars.has(char);
    const isSelected = selectedCharacter === char;

    return (
      <button
        key={char}
        onClick={() => onSelectCharacter(char)}
        className={cn(
          "relative w-10 h-10 rounded-lg font-mono text-lg font-medium transition-all duration-200",
          "flex items-center justify-center",
          "border border-border/50 hover:border-primary/50",
          isSelected && "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30",
          isRecorded && !isSelected && "bg-success/20 text-success border-success/30",
          !isRecorded && !isSelected && "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
      >
        {char}
        {isRecorded && !isSelected && (
          <Check className="absolute -top-1 -right-1 w-3 h-3 bg-success text-background rounded-full p-0.5" />
        )}
      </button>
    );
  };

  const completionStats = {
    uppercase: UPPERCASE.filter(c => recordedChars.has(c)).length,
    lowercase: LOWERCASE.filter(c => recordedChars.has(c)).length,
    numbers: NUMBERS.filter(c => recordedChars.has(c)).length,
    punctuation: PUNCTUATION.filter(c => recordedChars.has(c)).length,
    symbols: SYMBOLS.filter(c => recordedChars.has(c)).length,
  };

  const totalRecorded = recordedChars.size;
  const totalRequired = UPPERCASE.length + LOWERCASE.length + NUMBERS.length;
  const completionPercent = Math.round((totalRecorded / totalRequired) * 100);

  return (
    <div className="panel-glass p-4 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">Character Training Grid</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{totalRecorded}/{totalRequired}</span>
          <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono text-accent">{completionPercent}%</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-pulse text-muted-foreground">Loading characters...</div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Uppercase */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Uppercase A-Z
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({completionStats.uppercase}/{UPPERCASE.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {UPPERCASE.map(renderCharacterButton)}
            </div>
          </div>

          {/* Lowercase */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Lowercase a-z
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({completionStats.lowercase}/{LOWERCASE.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {LOWERCASE.map(renderCharacterButton)}
            </div>
          </div>

          {/* Numbers */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Numbers 0-9
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({completionStats.numbers}/{NUMBERS.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {NUMBERS.map(renderCharacterButton)}
            </div>
          </div>

          {/* Punctuation */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Punctuation
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({completionStats.punctuation}/{PUNCTUATION.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {PUNCTUATION.map(renderCharacterButton)}
            </div>
          </div>

          {/* Symbols */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Symbols
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({completionStats.symbols}/{SYMBOLS.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {SYMBOLS.map(renderCharacterButton)}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-3 border-t border-border/50 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Circle className="w-3 h-3 text-muted-foreground" />
          <span>Not recorded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="w-2 h-2 text-success" />
          </div>
          <span>Recorded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
}
