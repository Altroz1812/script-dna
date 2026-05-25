import { useEffect, useState, useCallback } from 'react';
import { Type } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { UploadedFont } from './FontUploadPanel';

interface FontPickerProps {
  activeFont: UploadedFont | null;
  onFontSelect: (font: UploadedFont | null) => void;
}

/**
 * Read-only font picker for students.
 * Lists fonts uploaded by admins/superadmins from the `uploaded_fonts` table
 * and registers the chosen one via the FontFace API for tracing overlays.
 * No upload / edit / delete capability.
 */
export function FontPicker({ activeFont, onFontSelect }: FontPickerProps) {
  const [fonts, setFonts] = useState<UploadedFont[]>([]);

  const loadFonts = useCallback(async () => {
    const { data, error } = await supabase
      .from('uploaded_fonts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setFonts(data as UploadedFont[]);
  }, []);

  useEffect(() => { loadFonts(); }, [loadFonts]);

  useEffect(() => {
    if (!activeFont) return;
    const familyName = `uploaded-${activeFont.id}`;
    let cancelled = false;

    const face = new FontFace(familyName, `url('${activeFont.file_url}?v=${Date.now()}')`, {
      display: 'swap' as FontDisplay,
    });

    face.load().then((loaded) => {
      if (cancelled) return;
      const toDelete: FontFace[] = [];
      document.fonts.forEach((f) => { if (f.family === familyName) toDelete.push(f); });
      toDelete.forEach((f) => document.fonts.delete(f));
      document.fonts.add(loaded);
    }).catch((err) => console.error('Font load error:', err));

    return () => {
      cancelled = true;
      const toDelete: FontFace[] = [];
      document.fonts.forEach((f) => { if (f.family === familyName) toDelete.push(f); });
      toDelete.forEach((f) => document.fonts.delete(f));
    };
  }, [activeFont]);

  return (
    <div className="panel-glass rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Tracing Font</span>
      </div>

      {fonts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No fonts available yet. Your teacher will add tracing fonts soon.
        </p>
      ) : (
        <Select
          value={activeFont?.id || '__none__'}
          onValueChange={(id) => {
            if (id === '__none__') return onFontSelect(null);
            const font = fonts.find(f => f.id === id);
            if (font) onFontSelect(font);
          }}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Choose a font to trace…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Free practice (no overlay)</SelectItem>
            {fonts.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.font_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
    </div>
  );
}