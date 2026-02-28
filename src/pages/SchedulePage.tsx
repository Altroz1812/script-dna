import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, CalendarDays } from 'lucide-react';
import { batchService } from '@/services/api/courseService';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ batch_id: '', title: '', day_of_week: '1', start_time: '09:00', end_time: '10:00', room: '' });
  const [filterBatch, setFilterBatch] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([adminQuery('list_schedules', filterBatch !== 'all' ? { batch_id: filterBatch } : {}), batchService.listBatches()]);
      setSchedules(s); setBatches(b);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filterBatch]);

  const handleCreate = async () => {
    if (!form.batch_id || !form.title.trim()) { toast.error('Batch and title required'); return; }
    try {
      await adminQuery('create_schedule', { ...form, day_of_week: parseInt(form.day_of_week), title: form.title.trim(), room: form.room || null });
      toast.success('Schedule created'); setOpen(false); setForm({ batch_id: '', title: '', day_of_week: '1', start_time: '09:00', end_time: '10:00', room: '' }); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await adminQuery('delete_schedule', { id }); toast.success('Deleted'); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        <div className="flex gap-2">
          <Select value={filterBatch} onValueChange={setFilterBatch}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter batch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Schedule Entry</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Batch</Label><Select value={form.batch_id} onValueChange={v => setForm(f => ({ ...f, batch_id: v }))}><SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger><SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>Day</Label><Select value={form.day_of_week} onValueChange={v => setForm(f => ({ ...f, day_of_week: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
                  <div><Label>End</Label><Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
                </div>
                <div><Label>Room</Label><Input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} /></div>
                <Button onClick={handleCreate} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Title</TableHead><TableHead>Batch</TableHead><TableHead>Room</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {schedules.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No schedules</TableCell></TableRow> :
                schedules.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{DAYS[s.day_of_week]}</TableCell>
                    <TableCell>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</TableCell>
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell>{s.batches?.name || '—'}</TableCell>
                    <TableCell>{s.room || '—'}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
