import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Users, GraduationCap } from 'lucide-react';

interface BatchWithCount {
  id: string;
  name: string;
  max_students: number;
  teacher_id: string | null;
  enrolled_count: number;
  teacher_name?: string | null;
}

interface BatchPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseName: string;
  onSelect: (batchId: string, batchName: string) => void;
}

export function BatchPickerDialog({ open, onOpenChange, courseId, courseName, onSelect }: BatchPickerDialogProps) {
  const [batches, setBatches] = useState<BatchWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelected('');
    setLoading(true);

    (async () => {
      // Use public edge function so unauthenticated landing-page visitors
      // can see available batches (RLS blocks direct anon reads on `batches`).
      const { data, error } = await supabase.functions.invoke('public-batches', {
        body: { course_id: courseId },
      });
      if (error || !Array.isArray(data)) {
        setBatches([]);
      } else {
        setBatches(data as BatchWithCount[]);
      }
      setLoading(false);
    })();
  }, [open, courseId]);

  const handleConfirm = () => {
    const batch = batches.find(b => b.id === selected);
    if (batch) onSelect(batch.id, batch.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Select a Batch
          </DialogTitle>
          <DialogDescription>
            Choose an available batch for "{courseName}"
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No batches available for this course yet.</div>
        ) : (
          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-3">
            {batches.map(b => {
              const isFull = b.enrolled_count >= b.max_students;
              const pct = Math.round((b.enrolled_count / b.max_students) * 100);
              const remaining = b.max_students - b.enrolled_count;
              const colorClass = pct >= 90 ? 'text-destructive' : pct >= 75 ? 'text-warning' : 'text-primary';

              return (
                <Label
                  key={b.id}
                  htmlFor={b.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    isFull ? 'opacity-50 cursor-not-allowed bg-muted/30' :
                    selected === b.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <RadioGroupItem value={b.id} id={b.id} disabled={isFull} className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{b.name}</span>
                      {isFull ? (
                        <Badge variant="destructive" className="text-[10px]">Full</Badge>
                      ) : (
                        <span className={`text-xs font-medium ${colorClass}`}>{remaining} seat{remaining !== 1 ? 's' : ''} left</span>
                      )}
                    </div>
                    {b.teacher_name && (
                      <p className="text-xs text-muted-foreground">Teacher: {b.teacher_name}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Users className="h-3 w-3" /> {b.enrolled_count}/{b.max_students}
                      </span>
                    </div>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Confirm & Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
