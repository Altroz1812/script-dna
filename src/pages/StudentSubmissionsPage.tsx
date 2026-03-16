import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, MessageSquare, FileCheck } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

export default function StudentSubmissionsPage() {
  const { profile } = useAuth();
  const { role } = useRBAC();
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [submitForm, setSubmitForm] = useState({ assignment_id: '', file_url: '' });
  const [reviewForm, setReviewForm] = useState({ score: '', feedback: '' });

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_submissions')
        .select('*, practice_assignments(title, batch_id, batches(name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSubmissions(data || []);

      if (isStudent) {
        const { data: a } = await supabase
          .from('practice_assignments')
          .select('id, title, batches(name)')
          .order('created_at', { ascending: false });
        setAssignments(a || []);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!submitForm.assignment_id) { toast.error('Select an assignment'); return; }
    try {
      const { error } = await supabase.from('student_submissions').insert({
        assignment_id: submitForm.assignment_id,
        student_id: profile?.id,
        file_url: submitForm.file_url || null,
      });
      if (error) throw error;
      toast.success('Submission uploaded');
      setSubmitOpen(false);
      setSubmitForm({ assignment_id: '', file_url: '' });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openReview = (sub: any) => {
    setSelectedSubmission(sub);
    setReviewForm({ score: sub.score?.toString() || '', feedback: sub.teacher_feedback || '' });
    setReviewOpen(true);
  };

  const handleReview = async () => {
    if (!selectedSubmission) return;
    try {
      const { error } = await supabase.from('student_submissions')
        .update({
          score: reviewForm.score ? parseFloat(reviewForm.score) : null,
          teacher_feedback: reviewForm.feedback || null,
          status: 'reviewed' as any,
        })
        .eq('id', selectedSubmission.id);
      if (error) throw error;
      toast.success('Review saved');
      setReviewOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusColor = (s: string) => s === 'reviewed'
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Submissions</h1>
          <p className="text-muted-foreground text-sm">
            {isTeacher ? 'Review student handwriting submissions' : 'Submit your practice work'}
          </p>
        </div>
        {isStudent && (
          <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
            <DialogTrigger asChild>
              <Button><Upload className="mr-2 h-4 w-4" />New Submission</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Submit Practice Work</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Assignment</Label>
                  <Select value={submitForm.assignment_id} onValueChange={v => setSubmitForm(f => ({ ...f, assignment_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger>
                    <SelectContent>
                      {assignments.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.title} — {(a as any).batches?.name || '—'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>File URL (image/PDF link)</Label><Input value={submitForm.file_url} onChange={e => setSubmitForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." /></div>
                <Button onClick={handleSubmit} className="w-full" disabled={!submitForm.assignment_id}>Submit</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Teacher review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Submission</DialogTitle></DialogHeader>
          {selectedSubmission && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{selectedSubmission.practice_assignments?.title}</p>
                {selectedSubmission.file_url && (
                  <a href={selectedSubmission.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs mt-1 block">View submitted file</a>
                )}
              </div>
              <div><Label>Score (optional)</Label><Input type="number" min="0" max="100" value={reviewForm.score} onChange={e => setReviewForm(f => ({ ...f, score: e.target.value }))} placeholder="0-100" /></div>
              <div><Label>Feedback</Label><Textarea value={reviewForm.feedback} onChange={e => setReviewForm(f => ({ ...f, feedback: e.target.value }))} placeholder="Great improvement on letter spacing..." /></div>
              <Button onClick={handleReview} className="w-full">Save Review</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {loading ? <TableSkeleton columns={4} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                {isTeacher && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.length === 0 ? (
                <TableRow><TableCell colSpan={isTeacher ? 5 : 4} className="text-center py-8 text-muted-foreground">
                  <FileCheck className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  No submissions yet
                </TableCell></TableRow>
              ) : submissions.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.practice_assignments?.title || '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{s.practice_assignments?.batches?.name || '—'}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={statusColor(s.status)}>{s.status}</Badge></TableCell>
                  <TableCell>{s.score != null ? `${s.score}/100` : '—'}</TableCell>
                  {isTeacher && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openReview(s)}>
                        <MessageSquare className="h-4 w-4 mr-1" />{s.status === 'reviewed' ? 'Edit' : 'Review'}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
