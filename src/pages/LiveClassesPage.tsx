import { useEffect, useState, useMemo } from 'react';
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
import { Plus, Trash2, Video, Link2 } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { batchService } from '@/services/api/courseService';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  live: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function LiveClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ batch_id: '', schedule_id: '', meeting_url: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [c, b] = await Promise.all([
        adminQuery('list_live_classes'),
        batchService.listBatches(),
      ]);
      setClasses(c);
      setBatches(b);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Load schedules when batch is selected
  const loadSchedules = async (batchId: string) => {
    try {
      const data = await adminQuery('list_schedules', { batch_id: batchId });
      setSchedules(data);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleBatchChange = (batchId: string) => {
    setForm(f => ({ ...f, batch_id: batchId, schedule_id: '' }));
    loadSchedules(batchId);
  };

  const selectedSchedule = useMemo(
    () => schedules.find(s => s.id === form.schedule_id),
    [schedules, form.schedule_id]
  );

  const handleCreate = async () => {
    if (!form.batch_id || !form.schedule_id) {
      toast.error('Select a batch and schedule entry');
      return;
    }
    const sched = selectedSchedule;
    if (!sched) return;

    // Build scheduled_at from schedule date + start_time
    const scheduledAt = sched.date
      ? `${sched.date}T${sched.start_time}`
      : new Date().toISOString();

    // Calculate duration from start/end time
    const [sh, sm] = (sched.start_time || '09:00').split(':').map(Number);
    const [eh, em] = (sched.end_time || '10:00').split(':').map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

    try {
      await adminQuery('create_live_class', {
        batch_id: form.batch_id,
        schedule_id: form.schedule_id,
        title: sched.title,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes > 0 ? durationMinutes : 60,
        meeting_url: form.meeting_url || null,
      });
      toast.success('Live class created from schedule');
      setOpen(false);
      setForm({ batch_id: '', schedule_id: '', meeting_url: '' });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await adminQuery('update_live_class', { id, status });
      toast.success('Updated');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminQuery('delete_live_class', { id });
      toast.success('Deleted');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Live Classes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Live Class</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Link Live Class to Schedule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Batch</Label>
                <Select value={form.batch_id} onValueChange={handleBatchChange}>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Schedule Entry</Label>
                <Select
                  value={form.schedule_id}
                  onValueChange={v => setForm(f => ({ ...f, schedule_id: v }))}
                  disabled={!form.batch_id}
                >
                  <SelectTrigger><SelectValue placeholder={form.batch_id ? 'Select schedule' : 'Pick a batch first'} /></SelectTrigger>
                  <SelectContent>
                    {schedules.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No schedules for this batch</div>
                    ) : (
                      schedules.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.date ? format(new Date(s.date), 'MMM d') : '—'} · {s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)} · {s.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedSchedule && (
                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                  <p className="font-medium">{selectedSchedule.title}</p>
                  <p className="text-muted-foreground">
                    {selectedSchedule.date ? format(new Date(selectedSchedule.date), 'MMM d, yyyy') : '—'} · {selectedSchedule.start_time?.slice(0, 5)} - {selectedSchedule.end_time?.slice(0, 5)}
                    {selectedSchedule.room && ` · Room: ${selectedSchedule.room}`}
                  </p>
                </div>
              )}

              <div>
                <Label>Meeting URL</Label>
                <Input
                  value={form.meeting_url}
                  onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))}
                  placeholder="https://meet.google.com/..."
                />
              </div>

              <Button onClick={handleCreate} className="w-full" disabled={!form.schedule_id}>
                Create Live Class
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <TableSkeleton columns={7} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Meeting</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Video className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    No live classes — link one from an existing schedule entry
                  </TableCell>
                </TableRow>
              ) : (
                classes.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {c.schedule_id && <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
                        {c.title}
                      </div>
                    </TableCell>
                    <TableCell>{c.batches?.name || '—'}</TableCell>
                    <TableCell>{new Date(c.scheduled_at).toLocaleString()}</TableCell>
                    <TableCell>{c.duration_minutes}m</TableCell>
                    <TableCell>
                      {c.meeting_url ? (
                        <a href={c.meeting_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                          Join
                        </a>
                      ) : '—'}
                    </TableCell>
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
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
