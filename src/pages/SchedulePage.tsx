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
import { Plus, Trash2, Wand2, AlertCircle } from 'lucide-react';
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
  const [manualOpen, setManualOpen] = useState(false);
  const [autoForm, setAutoForm] = useState({
    batch_id: '',
    start_date: '',
    working_days: [1, 2, 3, 4, 5] as number[],
    start_time: '09:00',
    end_time: '10:00',
    room: '',
  });
  const [manualForm, setManualForm] = useState({
    batch_id: '',
    title: '',
    date: '',
    day_of_week: 1,
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

  // Always fetch the full schedule list (unfiltered) for conflict detection,
  // independent of the table's batch filter.
  const { data: allSchedules = [] } = useQuery({
    queryKey: ['schedules', 'all-for-conflicts'],
    queryFn: () => adminQuery('list_schedules', {}),
    staleTime: 1000 * 60 * 2,
  });

  // All batch_students (org-scoped) so we can detect student cross-batch conflicts.
  const { data: allBatchStudents = [] } = useQuery<Array<{ batch_id: string; student_id: string }>>({
    queryKey: ['batch_students', 'all-for-conflicts'],
    queryFn: () => adminQuery('list_enrollments', {}),
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

  // ---------- Conflict detection ----------
  type Entry = { batch_id: string; date?: string | null; day_of_week: number; start_time: string; end_time: string; room?: string | null };
  type Conflict = { entry: Entry; with: any; reason: 'batch' | 'room' | 'teacher' | 'student'; when: string; detail?: string };

  const norm = (t?: string | null) => (t || '').slice(0, 5); // HH:MM
  const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
    norm(aStart) < norm(bEnd) && norm(bStart) < norm(aEnd);
  const sameRoom = (a?: string | null, b?: string | null) =>
    !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

  // Index helpers for teacher/student conflict detection
  const batchById = useMemo(() => {
    const m: Record<string, Batch> = {};
    for (const b of batches) m[b.id] = b;
    return m;
  }, [batches]);
  const studentsByBatch = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of allBatchStudents as any[]) {
      if (!m[r.batch_id]) m[r.batch_id] = new Set();
      m[r.batch_id].add(r.student_id);
    }
    return m;
  }, [allBatchStudents]);

  const findConflicts = (candidates: Entry[], existing: any[], excludeId?: string): Conflict[] => {
    const conflicts: Conflict[] = [];
    for (const cand of candidates) {
      const candBatch = batchById[cand.batch_id];
      const candTeacherId = candBatch?.teacher_id ?? null;
      const candStudents = studentsByBatch[cand.batch_id] ?? new Set<string>();
      for (const ex of existing) {
        if (excludeId && ex.id === excludeId) continue;
        // Compare same calendar date when both have it; otherwise fall back to day_of_week
        const sameWhen = cand.date && ex.date
          ? cand.date === ex.date
          : cand.day_of_week === ex.day_of_week;
        if (!sameWhen) continue;
        if (!overlaps(cand.start_time, cand.end_time, ex.start_time, ex.end_time)) continue;
        const when = cand.date && ex.date
          ? format(new Date(cand.date), 'MMM d, yyyy')
          : DAYS[cand.day_of_week];
        if (ex.batch_id === cand.batch_id) {
          conflicts.push({ entry: cand, with: ex, reason: 'batch', when });
        } else {
          if (sameRoom(cand.room, ex.room)) {
            conflicts.push({ entry: cand, with: ex, reason: 'room', when });
          }
          // Teacher double-booking across batches
          const exBatch = batchById[ex.batch_id];
          if (candTeacherId && exBatch?.teacher_id && exBatch.teacher_id === candTeacherId) {
            conflicts.push({
              entry: cand, with: ex, reason: 'teacher', when,
              detail: (exBatch as any)?.teacher_name || 'this teacher',
            });
          }
          // Student double-booking across batches
          const otherStudents = studentsByBatch[ex.batch_id];
          if (otherStudents && candStudents.size > 0) {
            let shared = 0;
            for (const sid of candStudents) if (otherStudents.has(sid)) shared++;
            if (shared > 0) {
              conflicts.push({
                entry: cand, with: ex, reason: 'student', when,
                detail: `${shared} student${shared === 1 ? '' : 's'}`,
              });
            }
          }
        }
      }
    }
    return conflicts;
  };

  // Auto-schedule conflicts (vs all existing schedules)
  const autoConflicts = useMemo(
    () => generatedEntries.length > 0 ? findConflicts(generatedEntries, allSchedules) : [],
    [generatedEntries, allSchedules]
  );

  // Manual schedule conflict for the single in-progress entry
  const manualCandidate: Entry | null = manualForm.batch_id && manualForm.start_time && manualForm.end_time && manualForm.start_time < manualForm.end_time
    ? {
        batch_id: manualForm.batch_id,
        date: manualForm.date || null,
        day_of_week: manualForm.date ? getDay(new Date(manualForm.date)) : manualForm.day_of_week,
        start_time: manualForm.start_time,
        end_time: manualForm.end_time,
        room: manualForm.room.trim() || null,
      }
    : null;
  const manualConflicts = useMemo(
    () => manualCandidate ? findConflicts([manualCandidate], allSchedules) : [],
    [manualCandidate, allSchedules]
  );

  const bulkMutation = useMutation({
    mutationFn: () => {
      if (autoConflicts.length > 0) throw new Error(`Cannot generate: ${autoConflicts.length} conflict(s) detected.`);
      return scheduleService.bulkCreateSchedules(generatedEntries);
    },
    onSuccess: () => {
      toast.success(`${generatedEntries.length} schedule entries created`);
      setOpen(false);
      setAutoForm({ batch_id: '', start_date: '', working_days: [1, 2, 3, 4, 5], start_time: '09:00', end_time: '10:00', room: '' });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create schedule entries'),
  });

  const manualMutation = useMutation({
    mutationFn: async () => {
      if (manualConflicts.length > 0) throw new Error(`Cannot create: ${manualConflicts.length} conflict(s) detected.`);
      const payload = {
        batch_id: manualForm.batch_id,
        title: manualForm.title.trim(),
        day_of_week: manualForm.day_of_week,
        start_time: manualForm.start_time,
        end_time: manualForm.end_time,
        room: manualForm.room.trim() || null,
        date: manualForm.date || null,
      };
      return adminQuery('create_schedule', payload);
    },
    onSuccess: () => {
      toast.success('Schedule entry created');
      setManualOpen(false);
      setManualForm({ batch_id: '', title: '', date: '', day_of_week: 1, start_time: '09:00', end_time: '10:00', room: '' });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create schedule'),
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

  // Surface why Auto-Schedule may be blocked
  const autoBlockers: string[] = [];
  if (!autoForm.batch_id) autoBlockers.push('Select a batch.');
  else if (!courseDays) autoBlockers.push('Selected batch\'s course has no duration (days). Edit the course to set Duration (days).');
  if (!autoForm.start_date) autoBlockers.push('Pick a start date.');
  if (!autoForm.working_days.length) autoBlockers.push('Choose at least one working day.');
  if (autoForm.start_time >= autoForm.end_time) autoBlockers.push('End time must be after start time.');

  // Auto-derive day_of_week from manual date
  const manualDateDow = manualForm.date ? getDay(new Date(manualForm.date)) : null;
  const manualBatch = batches.find(b => b.id === manualForm.batch_id);
  const manualCourseDays = manualBatch?.courses?.duration_days ?? 0;

  const manualErrors: { batch_id?: string; title?: string; start_time?: string; end_time?: string; course?: string } = {};
  if (!manualForm.batch_id) manualErrors.batch_id = 'Select a batch.';
  else if (!manualCourseDays) manualErrors.course = "This batch's course has no duration set. You can still add this entry, but please set Duration (days) on the course for accurate progress tracking.";
  if (!manualForm.title.trim()) manualErrors.title = 'Session title is required.';
  else if (manualForm.title.trim().length > 200) manualErrors.title = 'Title must be 200 characters or less.';
  if (!manualForm.start_time) manualErrors.start_time = 'Start time is required.';
  if (!manualForm.end_time) manualErrors.end_time = 'End time is required.';
  if (manualForm.start_time && manualForm.end_time && manualForm.start_time >= manualForm.end_time) {
    manualErrors.end_time = 'End time must be after start time.';
  }
  // Course-missing-duration is a warning, not a blocker
  const manualBlockingErrors = { ...manualErrors };
  delete manualBlockingErrors.course;
  const manualValid = Object.keys(manualBlockingErrors).length === 0;
  const errClass = (k: keyof typeof manualErrors) => manualErrors[k] && k !== 'course' ? 'border-destructive focus-visible:ring-destructive' : '';
  const FieldError = ({ msg }: { msg?: string }) => msg ? (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />{msg}</p>
  ) : null;

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
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Add Manually</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Schedule Entry</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Batch</Label>
                  <Select value={manualForm.batch_id} onValueChange={v => {
                    const b = batches.find(x => x.id === v);
                    setManualForm(f => ({ ...f, batch_id: v, title: f.title || (b?.courses?.name ?? '') }));
                  }}>
                    <SelectTrigger className={errClass('batch_id')}><SelectValue placeholder="Select batch" /></SelectTrigger>
                    <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name} — {b.courses?.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FieldError msg={manualErrors.batch_id} />
                  {manualErrors.course && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1 mt-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{manualErrors.course}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Session Title</Label>
                  <Input className={errClass('title')} value={manualForm.title} onChange={e => setManualForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Session 1: Introduction" maxLength={200} />
                  <FieldError msg={manualErrors.title} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date (optional)</Label>
                    <Input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value, day_of_week: e.target.value ? getDay(new Date(e.target.value)) : f.day_of_week }))} />
                  </div>
                  <div>
                    <Label>Day of Week</Label>
                    <Select
                      value={String(manualDateDow ?? manualForm.day_of_week)}
                      onValueChange={v => setManualForm(f => ({ ...f, day_of_week: parseInt(v, 10) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Time</Label>
                    <Input className={errClass('start_time')} type="time" value={manualForm.start_time} onChange={e => setManualForm(f => ({ ...f, start_time: e.target.value }))} />
                    <FieldError msg={manualErrors.start_time} />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input className={errClass('end_time')} type="time" value={manualForm.end_time} onChange={e => setManualForm(f => ({ ...f, end_time: e.target.value }))} />
                    <FieldError msg={manualErrors.end_time} />
                  </div>
                </div>
                <div><Label>Room (optional)</Label><Input value={manualForm.room} onChange={e => setManualForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room A or Online" /></div>
                {manualConflicts.length > 0 && (
                  <ConflictPanel conflicts={manualConflicts} batches={batches} />
                )}
                <Button
                  onClick={() => manualMutation.mutate()}
                  disabled={manualMutation.isPending || !manualValid || manualConflicts.length > 0}
                  className="w-full"
                >
                  {manualMutation.isPending ? 'Creating...' : manualConflicts.length > 0 ? 'Resolve conflicts to continue' : 'Create Schedule Entry'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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

                {autoConflicts.length > 0 && (
                  <ConflictPanel conflicts={autoConflicts} batches={batches} />
                )}

                {autoBlockers.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1">
                    <p className="font-medium text-destructive flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" /> Cannot generate yet
                    </p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                      {autoBlockers.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                    {autoBlockers.some(b => b.includes('duration')) && (
                      <p className="text-xs text-muted-foreground pt-1">
                        Tip: Use <span className="font-medium text-foreground">Add Manually</span> to create individual entries while you fix the course duration.
                      </p>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => bulkMutation.mutate()}
                  disabled={bulkMutation.isPending || generatedEntries.length === 0 || autoBlockers.length > 0 || autoConflicts.length > 0}
                  className="w-full"
                >
                  {bulkMutation.isPending
                    ? 'Creating...'
                    : autoConflicts.length > 0
                      ? `Resolve ${autoConflicts.length} conflict(s) to continue`
                      : `Generate ${generatedEntries.length} Schedule Entries`}
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

function ConflictPanel({
  conflicts,
  batches,
}: {
  conflicts: Array<{ entry: any; with: any; reason: 'batch' | 'room' | 'teacher' | 'student'; when: string; detail?: string }>;
  batches: Array<{ id: string; name: string }>;
}) {
  const batchName = (id: string) => batches.find(b => b.id === id)?.name || 'Unknown batch';
  const shown = conflicts.slice(0, 5);
  const extra = conflicts.length - shown.length;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2">
      <p className="font-medium text-destructive flex items-center gap-1.5">
        <AlertCircle className="h-4 w-4" /> {conflicts.length} schedule conflict{conflicts.length === 1 ? '' : 's'} detected
      </p>
      <ul className="text-xs space-y-1.5">
        {shown.map((c, i) => (
          <li key={i} className="text-muted-foreground">
            <span className="font-medium text-foreground">{c.when}</span>{' '}
            {c.entry.start_time?.slice(0, 5)}–{c.entry.end_time?.slice(0, 5)} clashes with{' '}
            <span className="font-medium text-foreground">{c.with.title}</span>{' '}
            ({batchName(c.with.batch_id)}, {c.with.start_time?.slice(0, 5)}–{c.with.end_time?.slice(0, 5)})
            {' — '}
            {c.reason === 'batch'
              ? <span className="text-destructive">same batch double-booked</span>
              : c.reason === 'room'
                ? <span className="text-destructive">room "{c.with.room}" already booked</span>
                : c.reason === 'teacher'
                  ? <span className="text-destructive">teacher already has another batch at this time</span>
                  : <span className="text-destructive">{c.detail || 'student(s)'} already in another batch at this time</span>}
          </li>
        ))}
        {extra > 0 && <li className="text-muted-foreground italic">…and {extra} more</li>}
      </ul>
      <p className="text-xs text-muted-foreground">
        Change time, room, date, teacher, or student assignments to resolve conflicts.
      </p>
    </div>
  );
}
