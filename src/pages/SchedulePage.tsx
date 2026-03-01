import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminQuery } from '@/services/api/adminService';
import { batchService, scheduleService, type Batch } from '@/services/api/courseService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { format, addDays, getDay } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WORKING_DAYS_OPTIONS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const [filterBatch, setFilterBatch] = useState('all');
  const [open, setOpen] = useState(false);
  const [autoForm, setAutoForm] = useState({
    batch_id: '',
    start_date: '',
    working_days: [1, 2, 3, 4, 5] as number[],
    start_time: '09:00',
    end_time: '10:00',
    room: '',
  });

  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: () => batchService.listBatches(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules', filterBatch],
    queryFn: () => adminQuery('list_schedules', filterBatch !== 'all' ? { batch_id: filterBatch } : {}),
    staleTime: 1000 * 60 * 2,
  });

  const selectedBatch = useMemo(() => batches.find(b => b.id === autoForm.batch_id), [batches, autoForm.batch_id]);
  const courseDays = selectedBatch?.courses?.duration_days ?? 0;
  const courseName = selectedBatch?.courses?.name ?? '';

  const generatedEntries = useMemo(() => {
    if (!autoForm.batch_id || !autoForm.start_date || !autoForm.working_days.length || !courseDays) return [];
    const entries: Array<{ batch_id: string; title: string; day_of_week: number; start_time: string; end_time: string; room: string | null; date: string }> = [];
    let current = new Date(autoForm.start_date);
    let count = 0;
    while (count < courseDays) {
      const dow = getDay(current);
      if (autoForm.working_days.includes(dow)) {
        entries.push({
          batch_id: autoForm.batch_id,
          title: courseName,
          day_of_week: dow,
          start_time: autoForm.start_time,
          end_time: autoForm.end_time,
          room: autoForm.room || null,
          date: format(current, 'yyyy-MM-dd'),
        });
        count++;
      }
      current = addDays(current, 1);
    }
    return entries;
  }, [autoForm, courseDays, courseName]);

  const bulkMutation = useMutation({
    mutationFn: () => scheduleService.bulkCreateSchedules(generatedEntries),
    onSuccess: () => {
      toast.success(`${generatedEntries.length} schedule entries created`);
      setOpen(false);
      setAutoForm({ batch_id: '', start_date: '', working_days: [1, 2, 3, 4, 5], start_time: '09:00', end_time: '10:00', room: '' });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminQuery('delete_schedule', { id }),
    onSuccess: () => {
      toast.success('Deleted');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDay = (day: number) => {
    setAutoForm(f => ({
      ...f,
      working_days: f.working_days.includes(day)
        ? f.working_days.filter(d => d !== day)
        : [...f.working_days, day].sort(),
    }));
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
            <DialogTrigger asChild><Button><Wand2 className="mr-2 h-4 w-4" />Auto-Schedule</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Auto-Generate Schedule</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Batch</Label>
                  <Select value={autoForm.batch_id} onValueChange={v => setAutoForm(f => ({ ...f, batch_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                    <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name} — {b.courses?.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {selectedBatch && (
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <p className="font-medium">{courseName}</p>
                    <p className="text-muted-foreground">
                      {courseDays} sessions · {selectedBatch.courses?.total_hours ?? '?'} total hours · {selectedBatch.courses?.daily_hours ?? 1} hr/day
                    </p>
                  </div>
                )}

                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={autoForm.start_date} onChange={e => setAutoForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>

                <div>
                  <Label className="mb-2 block">Working Days</Label>
                  <div className="flex gap-3 flex-wrap">
                    {WORKING_DAYS_OPTIONS.map(d => (
                      <label key={d.value} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={autoForm.working_days.includes(d.value)} onCheckedChange={() => toggleDay(d.value)} />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start Time</Label><Input type="time" value={autoForm.start_time} onChange={e => setAutoForm(f => ({ ...f, start_time: e.target.value }))} /></div>
                  <div><Label>End Time</Label><Input type="time" value={autoForm.end_time} onChange={e => setAutoForm(f => ({ ...f, end_time: e.target.value }))} /></div>
                </div>

                <div><Label>Room (optional)</Label><Input value={autoForm.room} onChange={e => setAutoForm(f => ({ ...f, room: e.target.value }))} /></div>

                {generatedEntries.length > 0 && (
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium mb-1">Preview: {generatedEntries.length} sessions</p>
                    <p className="text-muted-foreground">
                      {format(new Date(generatedEntries[0].date), 'MMM d, yyyy')} → {format(new Date(generatedEntries[generatedEntries.length - 1].date), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => bulkMutation.mutate()}
                  disabled={bulkMutation.isPending || generatedEntries.length === 0}
                  className="w-full"
                >
                  {bulkMutation.isPending ? 'Creating...' : `Generate ${generatedEntries.length} Schedule Entries`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? <TableSkeleton columns={6} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No schedules</TableCell></TableRow>
              ) : (
                schedules.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.date ? format(new Date(s.date), 'MMM d, yyyy') : '—'}</TableCell>
                    <TableCell>{DAYS[s.day_of_week]}</TableCell>
                    <TableCell>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</TableCell>
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell>{s.batches?.name || '—'}</TableCell>
                    <TableCell>{s.room || '—'}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
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
