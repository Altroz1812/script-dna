import { useState, useEffect, useCallback, useRef } from 'react';
import { Type, Download, Loader2, Keyboard, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FontMetadata } from './FontMetadataConfig';
import { HandwritingRenderer } from './HandwritingRenderer';

interface LiveTypeTesterProps {
  metadata: FontMetadata;
  onExportFont: () => void;
  isExporting: boolean;
}

const SYSTEM_FONTS = [
  { value: 'default', label: 'System Default' },
  { value: 'serif', label: 'Serif' },
  { value: 'sans-serif', label: 'Sans-Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'cursive', label: 'Cursive' },
];

// Unique font family name per generation to bust cache
let fontGenCounter = 0;

export function LiveTypeTester({ metadata, onExportFont, isExporting }: LiveTypeTesterProps) {
  const [text, setText] = useState('The quick brown fox jumps over the lazy dog.');
  const [selectedFont, setSelectedFont] = useState('generated');
  const [fontSize, setFontSize] = useState(32);
  const [characterCount, setCharacterCount] = useState(0);
  const [isLoadingFont, setIsLoadingFont] = useState(false);
  const [generatedFontFamily, setGeneratedFontFamily] = useState<string | null>(null);
  const [lastTtfBlob, setLastTtfBlob] = useState<Blob | null>(null);
  const fontUrlRef = useRef<string | null>(null);
  const styleElRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const fetchCharCount = async () => {
      const { count } = await supabase
        .from('font_library')
        .select('*', { count: 'exact', head: true });
      setCharacterCount(count || 0);
    };
    fetchCharCount();
  }, []);

  // Cleanup blob URL and style element on unmount
  useEffect(() => {
    return () => {
      if (fontUrlRef.current) URL.revokeObjectURL(fontUrlRef.current);
      if (styleElRef.current) styleElRef.current.remove();
    };
  }, []);

  const generateAndLoadFont = useCallback(async () => {
    setIsLoadingFont(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/compile-font`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ metadata }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errBody.message || errBody.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();

      // Save for later download
      setLastTtfBlob(blob);

      // Revoke old URL
      if (fontUrlRef.current) URL.revokeObjectURL(fontUrlRef.current);
      const url = URL.createObjectURL(blob);
      fontUrlRef.current = url;

      // Create unique family name
      fontGenCounter++;
      const familyName = `MyHandwriting_${fontGenCounter}`;

      // Remove old style element
      if (styleElRef.current) styleElRef.current.remove();

      // Inject @font-face
      const style = document.createElement('style');
      style.textContent = `
        @font-face {
          font-family: '${familyName}';
          src: url('${url}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
      `;
      document.head.appendChild(style);
      styleElRef.current = style;

      // Wait for font to load
      await document.fonts.load(`16px "${familyName}"`);

      setGeneratedFontFamily(familyName);

      toast({
        title: "Font Preview Ready",
        description: "Your handwriting font is loaded. Type to preview!",
      });
    } catch (error) {
      console.error('Error generating font preview:', error);
      toast({
        title: "Preview Failed",
        description: error instanceof Error ? error.message : "Could not generate font preview.",
        variant: "destructive",
      });
      setGeneratedFontFamily(null);
    } finally {
      setIsLoadingFont(false);
    }
  }, [metadata]);

  const handleDownloadTtf = useCallback(() => {
    if (!lastTtfBlob) {
      onExportFont();
      return;
    }
    const url = URL.createObjectURL(lastTtfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${metadata.fontName.replace(/\s+/g, '-')}.ttf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Font Downloaded",
      description: `"${metadata.fontName}.ttf" saved.`,
    });
  }, [lastTtfBlob, metadata.fontName, onExportFont]);

  const getFontFamily = () => {
    if (selectedFont === 'generated' && generatedFontFamily) {
      return `'${generatedFontFamily}', cursive`;
    }
    if (selectedFont === 'default') return 'inherit';
    return selectedFont;
  };

  const showGeneratedPreview = selectedFont === 'generated' && generatedFontFamily;
  const showVectorFallback = selectedFont === 'generated' && !generatedFontFamily;

  return (
    <div className="panel-glass p-4 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">Live Type Tester</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{characterCount} chars recorded</span>
        </div>
      </div>

      {/* Font Selection & Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedFont} onValueChange={setSelectedFont}>
          <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
            <SelectValue placeholder="Select font" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="generated">
              <span className="text-accent">✨</span> My Generated Font
            </SelectItem>
            {SYSTEM_FONTS.map(font => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Type className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[fontSize]}
            onValueChange={([value]) => setFontSize(value)}
            min={16}
            max={72}
            step={2}
            className="w-32"
          />
          <span className="font-mono text-sm text-muted-foreground w-10">{fontSize}px</span>
        </div>

        {selectedFont === 'generated' && (
          <Button
            onClick={generateAndLoadFont}
            disabled={isLoadingFont || characterCount === 0}
            variant="outline"
            size="sm"
            className="border-primary/50 text-primary hover:bg-primary/10"
          >
            {isLoadingFont ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Building…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                {generatedFontFamily ? 'Rebuild Font' : 'Generate Preview'}
              </>
            )}
          </Button>
        )}

        <Button
          onClick={lastTtfBlob ? handleDownloadTtf : onExportFont}
          disabled={isExporting || characterCount === 0}
          variant="outline"
          className="border-accent/50 text-accent hover:bg-accent/10"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download TTF
            </>
          )}
        </Button>
      </div>

      {/* Font Preview Area */}
      <div className="relative min-h-[200px] bg-secondary/30 border border-border/50 rounded-lg p-6 overflow-hidden">
        {isLoadingFont && selectedFont === 'generated' && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Compiling TTF…</span>
            </div>
          </div>
        )}

        {showVectorFallback && (
          <>
            {characterCount === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[160px] text-muted-foreground text-sm">
                Record some characters first, then click "Generate Preview" to see your font.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                  Click <strong>"Generate Preview"</strong> to compile and load your handwriting as a real TTF font.
                </div>
                <HandwritingRenderer
                  text={text}
                  fontSize={fontSize}
                  lineHeight={metadata.lineHeight}
                  letterSpacing={metadata.globalKerning}
                />
              </div>
            )}
          </>
        )}

        {showGeneratedPreview && (
          <div
            className="whitespace-pre-wrap break-words text-foreground"
            style={{
              fontFamily: getFontFamily(),
              fontSize: `${fontSize}px`,
              lineHeight: `${metadata.lineHeight}%`,
              letterSpacing: `${metadata.globalKerning / 100}em`,
              fontKerning: 'normal',
              fontVariantLigatures: 'normal',
              fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "kern" 1',
              textRendering: 'optimizeLegibility',
            }}
          >
            {text}
          </div>
        )}

        {selectedFont !== 'generated' && (
          <div
            className="whitespace-pre-wrap break-words text-foreground"
            style={{
              fontFamily: getFontFamily(),
              fontSize: `${fontSize}px`,
              lineHeight: `${metadata.lineHeight}%`,
              letterSpacing: `${metadata.globalKerning / 100}em`,
              fontKerning: 'normal',
              fontVariantLigatures: 'normal',
              fontFeatureSettings: '"liga" 1, "clig" 1, "calt" 1, "kern" 1',
              textRendering: 'optimizeLegibility',
            }}
          >
            {text}
          </div>
        )}
      </div>

      {/* Text Input */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type here to test your font..."
        className="min-h-[80px] bg-secondary/30 border-border/50 resize-none text-sm"
      />

      {/* Sample Texts */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Quick Samples</div>
        <div className="flex flex-wrap gap-2">
          {[
            'The quick brown fox jumps over the lazy dog.',
            'Pack my box with five dozen liquor jugs.',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            'abcdefghijklmnopqrstuvwxyz',
            '0123456789',
          ].map((sample, i) => (
            <button
              key={i}
              onClick={() => setText(sample)}
              className="px-3 py-1.5 bg-secondary/50 hover:bg-secondary rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {sample.length > 30 ? sample.slice(0, 30) + '...' : sample}
            </button>
          ))}
        </div>
      </div>

      {/* Export Requirements */}
      <div className="pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Export Requirements</span>
          <div className="flex items-center gap-4">
            <span className={characterCount >= 26 ? "text-success" : "text-destructive"}>
              A-Z: {Math.min(characterCount, 26)}/26
            </span>
            <span className={characterCount >= 52 ? "text-success" : "text-muted-foreground"}>
              a-z: {Math.max(0, Math.min(characterCount - 26, 26))}/26
            </span>
            <span className={characterCount >= 62 ? "text-success" : "text-muted-foreground"}>
              0-9: {Math.max(0, Math.min(characterCount - 52, 10))}/10
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
