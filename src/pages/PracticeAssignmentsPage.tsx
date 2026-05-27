import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
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
import { Plus, FileText, Calendar, Download, ExternalLink, Upload } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { format } from 'date-fns';

export default function PracticeAssignmentsPage() {
  const { profile } = useAuth();
  const { role } = useRBAC();
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const { activeOrgId } = useActiveOrg();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', batch_id: '', due_date: '', file_url: '' });
  const [uploading, setUploading] = useState(false);

  const normalizeUrl = (url: string) => {
    const u = (url || '').trim();
    if (!u) return '';
    if (/^(https?:|mailto:|tel:|\/)/i.test(u)) return u;
    return `https://${u}`;
  };

  const getAssignmentFileHref = (url: string) => {
    const u = (url || '').trim();
    if (!u) return '';

    if (/^practice-assignments\//i.test(u)) {
      return supabase.storage.from('materials').getPublicUrl(u).data.publicUrl;
    }

    if (/^materials\/practice-assignments\//i.test(u)) {
      return supabase.storage.from('materials').getPublicUrl(u.replace(/^materials\//i, '')).data.publicUrl;
    }

    const normalized = normalizeUrl(u);
    try {
      const parsed = new URL(normalized, window.location.origin);
      const isAuraPenRoot = /(^|\.)aurapen\.com$/i.test(parsed.hostname) && parsed.pathname.replace(/\/$/, '') === '';
      return isAuraPenRoot ? '' : parsed.href;
    } catch {
      return '';
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `practice-assignments/${profile!.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('materials').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('materials').getPublicUrl(path);
      setForm(f => ({ ...f, file_url: data.publicUrl }));
      toast.success('File uploaded');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminQuery('list_practice_assignments').catch(async () => {
        // Fallback: server may not expose a dedicated handler. Use a safe path.
        return [];
      });
      setAssignments(data || []);

      if (isTeacher) {
        const b = await adminQuery('list_batches');
        setBatches(b || []);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeOrgId]);

  const handleCreate = async () => {
    if (!form.title || !form.batch_id) {
      toast.error('Title and batch are required');
      return;
    }
    try {
      await adminQuery('create_practice_assignment', {
        teacher_id: profile?.id,
        batch_id: form.batch_id,
        title: form.title,
        description: form.description || null,
        due_date: form.due_date || null,
        file_url: form.file_url ? normalizeUrl(form.file_url) : null,
      });
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
      await adminQuery('delete_practice_assignment', { id });
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
                <div>
                  <Label>Upload File (PDF / image, optional)</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                    disabled={uploading}
                  />
                  {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
                </div>
                <div>
                  <Label>Or paste a Reference URL</Label>
                  <Input
                    value={form.file_url}
                    onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                    placeholder="https://example.com/sheet.pdf"
                  />
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!form.title || !form.batch_id}>Create Assignment</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? <TableSkeleton columns={isStudent ? 4 : 4} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>{isStudent ? 'Download' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {a.file_url && getAssignmentFileHref(a.file_url) ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={getAssignmentFileHref(a.file_url)} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5 mr-1" />{isStudent ? 'Download' : 'View'}
                          </a>
                        </Button>
                      ) : a.file_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => toast.error('No uploaded document is linked to this assignment')}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />No document
                        </Button>
                      ) : null}
                      {isTeacher && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(a.id)}>Delete</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
