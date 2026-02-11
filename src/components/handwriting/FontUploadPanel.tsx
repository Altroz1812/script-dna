import { useState, useEffect, useCallback } from 'react';
import { Upload, ChevronDown, ChevronUp, Type, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UploadedFont {
  id: string;
  font_name: string;
  file_url: string;
  created_at: string;
}

interface FontUploadPanelProps {
  activeFont: UploadedFont | null;
  onFontSelect: (font: UploadedFont | null) => void;
}

export function FontUploadPanel({ activeFont, onFontSelect }: FontUploadPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [fonts, setFonts] = useState<UploadedFont[]>([]);
  const [fontName, setFontName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const loadFonts = useCallback(async () => {
    const { data, error } = await supabase
      .from('uploaded_fonts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setFonts(data as UploadedFont[]);
  }, []);

  useEffect(() => { loadFonts(); }, [loadFonts]);

  // Inject font using FontFace API for reliable cross-font switching
  useEffect(() => {
    if (!activeFont) return;
    const familyName = `uploaded-${activeFont.id}`;
    let cancelled = false;

    const face = new FontFace(familyName, `url('${activeFont.file_url}?v=${Date.now()}')`, {
      display: 'swap' as FontDisplay,
    });

    face.load().then((loadedFace) => {
      if (cancelled) return;
      // Remove any prior version of this family
      const toDelete: FontFace[] = [];
      document.fonts.forEach((f) => {
        if (f.family === familyName) toDelete.push(f);
      });
      toDelete.forEach((f) => document.fonts.delete(f));
      document.fonts.add(loadedFace);
    }).catch((err) => {
      console.error('Font load error:', err);
    });

    return () => {
      cancelled = true;
      const toDelete: FontFace[] = [];
      document.fonts.forEach((f) => {
        if (f.family === familyName) toDelete.push(f);
      });
      toDelete.forEach((f) => document.fonts.delete(f));
    };
  }, [activeFont]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.ttf')) {
      toast({ title: 'Invalid File', description: 'Please upload a .ttf font file.', variant: 'destructive' });
      return;
    }
    if (!fontName.trim()) {
      toast({ title: 'Name Required', description: 'Enter a font name before uploading.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const trimmedName = fontName.trim();
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('uploaded-fonts')
        .upload(fileName, file, { contentType: 'font/ttf' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('uploaded-fonts')
        .getPublicUrl(fileName);

      // Check for existing font with same name and overwrite
      const existing = fonts.find(f => f.font_name.toLowerCase() === trimmedName.toLowerCase());
      let resultRow: UploadedFont;

      if (existing) {
        // Remove old @font-face style so browser doesn't cache stale file
        const oldStyle = document.getElementById(`font-face-${existing.id}`);
        oldStyle?.remove();

        const { data: row, error: updateError } = await supabase
          .from('uploaded_fonts')
          .update({ file_url: urlData.publicUrl })
          .eq('id', existing.id)
          .select()
          .single();
        if (updateError) throw updateError;
        resultRow = row as UploadedFont;
        toast({ title: 'Font Updated', description: `"${trimmedName}" has been overwritten.` });
      } else {
        const { data: row, error: insertError } = await supabase
          .from('uploaded_fonts')
          .insert({ font_name: trimmedName, file_url: urlData.publicUrl })
          .select()
          .single();
        if (insertError) throw insertError;
        resultRow = row as UploadedFont;
        toast({ title: 'Font Uploaded', description: `"${trimmedName}" is ready to use.` });
      }

      setFontName('');
      await loadFonts();
      onFontSelect(resultRow);
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'Upload Failed', description: 'Could not upload font file.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="panel-glass rounded-xl overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-accent/10 transition-colors">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Import Font (TTF)</span>
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </CollapsibleTrigger>

        <CollapsibleContent className="px-4 pb-4 space-y-3">
          {/* Font name input */}
          <Input
            placeholder="Font name (e.g. My Cursive)"
            value={fontName}
            onChange={(e) => setFontName(e.target.value)}
            className="text-sm"
          />

          {/* Upload button */}
          <div className="relative">
            <Button
              variant="outline"
              className="w-full pointer-events-none"
              disabled={isUploading || !fontName.trim()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload .ttf File'}
            </Button>
            <input
              type="file"
              accept=".ttf"
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              onChange={handleUpload}
              disabled={isUploading || !fontName.trim()}
            />
          </div>

          {/* Previously uploaded fonts */}
          {fonts.length > 0 && (
            <div className="space-y-1">
              <Select
                value={activeFont?.id || ''}
                onValueChange={(id) => {
                  if (id === '__none__') {
                    onFontSelect(null);
                  } else {
                    const font = fonts.find(f => f.id === id);
                    if (font) onFontSelect(font);
                  }
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select uploaded font…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No overlay font</SelectItem>
                  {fonts.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.font_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Delete buttons for each font */}
              <div className="flex flex-wrap gap-1">
                {fonts.map(f => (
                  <button
                    key={f.id}
                    onClick={async () => {
                      if (!confirm(`Delete "${f.font_name}"?`)) return;
                      // Remove @font-face
                      document.getElementById(`font-face-${f.id}`)?.remove();
                      // Delete DB row
                      await supabase.from('uploaded_fonts').delete().eq('id', f.id);
                      if (activeFont?.id === f.id) onFontSelect(null);
                      await loadFonts();
                      toast({ title: 'Deleted', description: `"${f.font_name}" removed.` });
                    }}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    {f.font_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active font preview */}
          {activeFont && (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Preview</p>
              <p
                className="text-2xl leading-relaxed text-foreground"
                style={{ fontFamily: `'uploaded-${activeFont.id}', cursive` }}
              >
                The quick brown fox
              </p>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
