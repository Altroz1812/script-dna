import { useEffect, useRef, useState } from 'react';
import { Camera, FileCheck, Upload, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerRow } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { FAB } from '@/components/mobile/ui/FAB';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const STATUS: Record<string, string> = {
  submitted: 'bg-blue-500/20 text-blue-400',
  reviewed: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-muted/30 text-muted-foreground',
  rejected: 'bg-destructive/20 text-destructive',
};

export default function MobileStudentSubmissionsPage() {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [subs, setSubs] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ assignment_id: '', file: null as File | null });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: a }] = await Promise.all([
        supabase
          .from('student_submissions')
          .select('*, practice_assignments(title, batches(name))')
          .eq('student_id', profile!.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('practice_assignments')
          .select('id, title, batches(name)')
          .order('created_at', { ascending: false }),
      ]);
      setSubs(s || []);
      setAssignments(a || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile) load(); }, [profile?.id]);

  const submit = async () => {
    if (!form.assignment_id) return toast.error('Pick an assignment');
    setUploading(true);
    try {
      let fileUrl: string | null = null;
      if (form.file) {
        const ext = form.file.name.split('.').pop();
        const path = `${profile!.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('submissions').upload(path, form.file);
        if (error) throw error;
        const { data } = supabase.storage.from('submissions').getPublicUrl(path);
        fileUrl = data.publicUrl;
      }
      const { error } = await supabase.from('student_submissions').insert([{
        student_id: profile!.id,
        assignment_id: form.assignment_id,
        file_url: fileUrl ?? undefined,
        status: 'pending',
      }]);
      if (error) throw error;
      toast.success('Submitted');
      setOpen(false);
      setForm({ assignment_id: '', file: null });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <MobilePage onRefresh={load}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">Submissions</h1>
        <p className="text-xs text-muted-foreground mt-1">Your practice work and feedback</p>
      </div>

      {loading ? (
        <div className="space-y-2"><ShimmerRow /><ShimmerRow /><ShimmerRow /></div>
      ) : subs.length === 0 ? (
        <EmptyState icon={FileCheck} title="No submissions yet" message="Tap + to submit your first one." />
      ) : (
        <div className="space-y-2">
          {subs.map((s) => (
            <div key={s.id} className="rounded-xl p-3 bg-card border border-white/[0.06] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
                <FileCheck className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {s.practice_assignments?.title || 'Submission'}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {s.practice_assignments?.batches?.name || '—'} · {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${STATUS[s.status] || STATUS.pending}`}>
                {s.status}{s.score != null ? ` · ${s.score}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <FAB icon={Plus} onClick={() => setOpen(true)} label="Submit" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={form.assignment_id} onValueChange={(v) => setForm({ ...form, assignment_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
            />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <Camera className="w-4 h-4 mr-2" />
              {form.file ? form.file.name : 'Add Photo / File'}
            </Button>
            <Button className="w-full" disabled={uploading} onClick={submit}>
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Submit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MobilePage>
  );
}