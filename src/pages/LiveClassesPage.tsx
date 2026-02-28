import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Video } from 'lucide-react';
import { batchService } from '@/services/api/courseService';

const STATUS_COLORS: Record<string, string> = { scheduled: 'bg-blue-100 text-blue-800', live: 'bg-green-100 text-green-800', completed: 'bg-gray-100 text-gray-800', cancelled: 'bg-red-100 text-red-800' };

export default function LiveClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ batch_id: '', title: '', meeting_url: '', scheduled_at: '', duration_minutes: 60 });

  const load = async () => {
    setLoading(true);
    try { const [c, b] = await Promise.all([adminQuery('list_live_classes'), batchService.listBatches()]); setClasses(c); setBatches(b); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.batch_id || !form.title.trim() || !form.scheduled_at) { toast.error('Batch, title and time required'); return; }
    try { await adminQuery('create_live_class', { ...form, title: form.title.trim(), meeting_url: form.meeting_url || null }); toast.success('Created'); setOpen(false); load(); } catch (e: any) { toast.error(e.message); }
  };

  const updateStatus = async (id: string, status: string) => {
    try { await adminQuery('update_live_class', { id, status }); toast.success('Updated'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await adminQuery('delete_live_class', { id }); toast.success('Deleted'); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Live Classes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Schedule Class</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule Live Class</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Batch</Label><Select value={form.batch_id} onValueChange={v => setForm(f => ({ ...f, batch_id: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Scheduled At</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} /></div>
              <div><Label>Meeting URL</Label><Input value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))} placeholder="https://..." /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 60 }))} /></div>
              <Button onClick={handleCreate} className="w-full">Schedule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Batch</TableHead><TableHead>Time</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {classes.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground"><Video className="mx-auto h-8 w-8 mb-2 opacity-50" />No live classes</TableCell></TableRow> :
                classes.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.batches?.name || '—'}</TableCell>
                    <TableCell>{new Date(c.scheduled_at).toLocaleString()}</TableCell>
                    <TableCell>{c.duration_minutes}m</TableCell>
                    <TableCell>
                      <Select value={c.status} onValueChange={v => updateStatus(c.id, v)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
