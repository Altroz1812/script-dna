import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, FileText, Calendar } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { format } from 'date-fns';

export default function PracticeAssignmentsPage() {
  const { profile } = useAuth();
  const { role } = useRBAC();
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  const [assignments, setAssignments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', batch_id: '', due_date: '', file_url: '' });

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('practice_assignments')
        .select('*, batches(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAssignments(data || []);

      if (isTeacher) {
        const { data: b } = await supabase.from('batches').select('id, name');
        setBatches(b || []);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title || !form.batch_id) {
      toast.error('Title and batch are required');
      return;
    }
    try {
      const { error } = await supabase.from('practice_assignments').insert({
        teacher_id: profile?.id,
        batch_id: form.batch_id,
        title: form.title,
        description: form.description || null,
        due_date: form.due_date || null,
        file_url: form.file_url || null,
      });
      if (error) throw error;
      toast.success('Assignment created');
      setOpen(false);
      setForm({ title: '', description: '', batch_id: '', due_date: '', file_url: '' });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('practice_assignments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Practice Assignments</h1>
          <p className="text-muted-foreground text-sm">
            {isStudent ? 'Practice sheets assigned to you' : 'Assign and manage practice sheets'}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Assignment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Practice Assignment</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Cursive Letter Practice" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Instructions for students..." /></div>
                <div>
                  <Label>Batch</Label>
                  <Select value={form.batch_id} onValueChange={v => setForm(f => ({ ...f, batch_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                    <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Due Date (optional)</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                <div><Label>Reference File URL (optional)</Label><Input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." /></div>
                <Button onClick={handleCreate} className="w-full" disabled={!form.title || !form.batch_id}>Create Assignment</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? <TableSkeleton columns={4} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Due Date</TableHead>
                {isTeacher && <TableHead className="w-20">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow><TableCell colSpan={isTeacher ? 4 : 3} className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  No assignments yet
                </TableCell></TableRow>
              ) : assignments.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{a.title}</span>
                      {a.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{a.batches?.name || '—'}</Badge></TableCell>
                  <TableCell>
                    {a.due_date ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {format(new Date(a.due_date), 'MMM d, yyyy')}
                      </span>
                    ) : '—'}
                  </TableCell>
                  {isTeacher && (
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(a.id)}>Delete</Button>
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
