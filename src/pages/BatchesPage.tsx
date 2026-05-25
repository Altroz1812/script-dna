import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { useRBAC } from '@/hooks/useRBAC';
import { courseService, batchService, type Course, type Batch, type ConflictInfo } from '@/services/api/courseService';
import { scheduleService } from '@/services/api/courseService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Users, UserPlus, UserMinus, Layers, Wifi, Building2, Pencil, AlertCircle } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/loading-skeletons';
import { useIsMobileApp } from '@/hooks/useIsMobileApp';
import MobileBatchesPage from './mobile/MobileBatchesPage';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ConflictBanner({ title, conflicts }: { title: string; conflicts: ConflictInfo[] }) {
  if (!conflicts.length) return null;
  const shown = conflicts.slice(0, 5);
  const extra = conflicts.length - shown.length;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2">
      <p className="font-medium text-destructive flex items-center gap-1.5">
        <AlertCircle className="h-4 w-4" /> {title}
      </p>
      <ul className="text-xs space-y-1 text-muted-foreground">
        {shown.map((c, i) => (
          <li key={i}>
            <span className="font-medium text-foreground">
              {c.date ? new Date(c.date).toLocaleDateString() : DAYS[c.day_of_week]}
            </span>{' '}
            {c.start_time?.slice(0,5)}–{c.end_time?.slice(0,5)} in{' '}
            <span className="font-medium text-foreground">{c.other_batch_name}</span>
          </li>
        ))}
        {extra > 0 && <li className="italic">…and {extra} more</li>}
      </ul>
    </div>
  );
}

export default function BatchesPage() {
  const __isMobile = useIsMobileApp();
  if (__isMobile) return <MobileBatchesPage />;
  const { profile } = useAuth();
  const { activeOrgId } = useActiveOrg();
  const { isAdmin } = useRBAC();
  const queryClient = useQueryClient();

  // create batch form
  const [open, setOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [maxStudents, setMaxStudents] = useState(25);
  // create batch schedule fields
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:00');
  const [weekdays, setWeekdays] = useState<number[]>([]); // 0=Sun..6=Sat
  const [createTeacher, setCreateTeacher] = useState<string>('');
  const [createTeacherList, setCreateTeacherList] = useState<{ user_id: string; display_name: string | null; email: string | null }[]>([]);
  const [createConflicts, setCreateConflicts] = useState<ConflictInfo[]>([]);
  const [checkingCreate, setCheckingCreate] = useState(false);

  // edit batch dialog
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [editName, setEditName] = useState('');
  const [editMaxStudents, setEditMaxStudents] = useState(25);

  // assign teacher dialog
  const [teacherDialogBatch, setTeacherDialogBatch] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<{ user_id: string; display_name: string | null; email: string | null }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [teacherConflicts, setTeacherConflicts] = useState<ConflictInfo[]>([]);
  const [checkingTeacher, setCheckingTeacher] = useState(false);

  // assign student dialog
  const [studentDialogBatch, setStudentDialogBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<{ id: string; user_id: string; display_name: string | null; email: string | null }[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<{ id: string; student_id: string; display_name?: string | null; email?: string | null }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentCount, setStudentCount] = useState(0);
  const [studentConflicts, setStudentConflicts] = useState<ConflictInfo[]>([]);
  const [checkingStudent, setCheckingStudent] = useState(false);

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['courses', activeOrgId],
    queryFn: () => courseService.listCourses(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches', activeOrgId],
    queryFn: () => batchService.listBatches(),
    staleTime: 1000 * 60 * 5,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    queryClient.invalidateQueries({ queryKey: ['course_batches'] });
    queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const orgId = activeOrgId ?? profile?.organizationId;
      if (!orgId) throw new Error('Pick an organization first');
      const dayOfStart = new Date(startDate + 'T00:00:00').getDay();
      const days = weekdays.length ? weekdays : [dayOfStart];

      // Pre-flight conflict check against teacher (if picked)
      if (createTeacher && createTeacher !== '__none__') {
        const { teacher_conflicts } = await batchService.checkSlotConflicts({
          teacher_id: createTeacher,
          date: startDate,
          day_of_week: dayOfStart,
          start_time: startTime,
          end_time: endTime,
        });
        if (teacher_conflicts.length) {
          setCreateConflicts(teacher_conflicts);
          throw new Error('Selected teacher already has another batch in this time slot. Pick another teacher or time.');
        }
      }

      const batch = await batchService.createBatch(orgId, selectedCourse, batchName.trim(), maxStudents);
      try {
        const rows = days.map((dow) => ({
          batch_id: batch.id,
          title: batchName.trim(),
          day_of_week: dow,
          start_time: startTime,
          end_time: endTime,
          room: null,
          date: dow === dayOfStart ? startDate : (null as any),
          organization_id: orgId,
        }));
        await scheduleService.bulkCreateSchedules(rows as any);
        if (createTeacher && createTeacher !== '__none__') {
          await batchService.assignTeacher(batch.id, createTeacher);
        }
      } catch (err) {
        // Rollback batch if schedule/teacher assignment fails
        try { await batchService.deleteBatch(batch.id); } catch (_) {}
        throw err;
      }
      return batch;
    },
    onSuccess: () => {
      toast.success('Batch created');
      setBatchName(''); setSelectedCourse(''); setMaxStudents(25);
      setStartDate(''); setStartTime('16:00'); setEndTime('17:00'); setWeekdays([]);
      setCreateTeacher(''); setCreateConflicts([]);
      setOpen(false);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => batchService.deleteBatch(id),
    onSuccess: () => { toast.success('Batch deleted'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: () => batchService.updateBatch(editBatch!.id, editName.trim(), editMaxStudents),
    onSuccess: () => {
      toast.success('Batch updated');
      setEditBatch(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleEditBatch = () => {
    if (!editName.trim()) { toast.error('Batch name is required'); return; }
    if (editMaxStudents < 1 || editMaxStudents > 100) { toast.error('Max students must be 1-100'); return; }
    editMutation.mutate();
  };

  const openEditDialog = (batch: Batch) => {
    setEditBatch(batch);
    setEditName(batch.name);
    setEditMaxStudents(batch.max_students);
  };

  const assignTeacherMutation = useMutation({
    mutationFn: async () => {
      const teacherId = selectedTeacher === '__none__' ? null : selectedTeacher;
      if (teacherId) {
        const conflicts = await batchService.checkTeacherConflicts(teacherId, teacherDialogBatch!);
        if (conflicts.length > 0) {
          setTeacherConflicts(conflicts);
          throw new Error('Teacher already has another batch assigned for the selected time slot. Please choose another teacher or time slot.');
        }
      }
      return batchService.assignTeacher(teacherDialogBatch!, teacherId);
    },
    onSuccess: () => {
      toast.success('Teacher assigned');
      setTeacherDialogBatch(null); setSelectedTeacher(''); setTeacherConflicts([]);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Live check when teacher is selected
  const onTeacherChange = async (value: string) => {
    setSelectedTeacher(value);
    setTeacherConflicts([]);
    if (!teacherDialogBatch || value === '__none__' || !value) return;
    setCheckingTeacher(true);
    try {
      const conflicts = await batchService.checkTeacherConflicts(value, teacherDialogBatch);
      setTeacherConflicts(conflicts);
    } catch (e: any) {
      // soft-fail; user can still try to save which will re-check
    } finally {
      setCheckingTeacher(false);
    }
  };

  const handleCreateBatch = () => {
    if (!batchName.trim()) { toast.error('Batch name is required'); return; }
    if (!selectedCourse) { toast.error('Select a course'); return; }
    if (maxStudents < 1 || maxStudents > 100) { toast.error('Max students must be 1-100'); return; }
    if (!startDate) { toast.error('Pick a start date'); return; }
    if (new Date(startDate + 'T00:00:00') < new Date(new Date().toDateString())) {
      toast.error('Start date cannot be in the past'); return;
    }
    if (!startTime || !endTime) { toast.error('Set start & end time'); return; }
    if (endTime <= startTime) { toast.error('End time must be after start time'); return; }
    createMutation.mutate();
  };

  // Load teachers list on dialog open
  const onOpenChange = async (v: boolean) => {
    setOpen(v);
    if (v && createTeacherList.length === 0) {
      try { setCreateTeacherList(await batchService.listTeachers()); } catch (_) {}
    }
    if (!v) setCreateConflicts([]);
  };

  // Live conflict check as user changes slot/teacher
  const recheckCreateConflicts = async (overrides?: Partial<{ teacher: string; date: string; sTime: string; eTime: string }>) => {
    const teacher = overrides?.teacher ?? createTeacher;
    const d = overrides?.date ?? startDate;
    const s = overrides?.sTime ?? startTime;
    const e = overrides?.eTime ?? endTime;
    if (!teacher || teacher === '__none__' || !d || !s || !e || e <= s) {
      setCreateConflicts([]); return;
    }
    setCheckingCreate(true);
    try {
      const { teacher_conflicts } = await batchService.checkSlotConflicts({
        teacher_id: teacher,
        date: d,
        day_of_week: new Date(d + 'T00:00:00').getDay(),
        start_time: s,
        end_time: e,
      });
      setCreateConflicts(teacher_conflicts);
    } catch (_) {
      setCreateConflicts([]);
    } finally {
      setCheckingCreate(false);
    }
  };

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const openTeacherDialog = async (batchId: string) => {
    setTeacherDialogBatch(batchId);
    setSelectedTeacher(''); setTeacherConflicts([]);
    try {
      setTeachers(await batchService.listTeachers({ excludeAssigned: true, batchId }));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openStudentDialog = useCallback(async (batch: Batch) => {
    setStudentDialogBatch(batch);
    setSelectedStudent(''); setStudentConflicts([]);
    try {
      const [studs, enrolled, count] = await Promise.all([
        batchService.listStudents(),
        batchService.getStudents(batch.id),
        batchService.getStudentCount(batch.id),
      ]);
      setStudents(studs);
      setEnrolledStudents(enrolled.map((e: any) => ({
        id: e.id,
        student_id: e.student_id,
        display_name: e.profiles?.display_name ?? null,
        email: e.profiles?.email ?? null,
      })));
      setStudentCount(count);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, []);

  const onStudentChange = async (value: string) => {
    setSelectedStudent(value);
    setStudentConflicts([]);
    if (!studentDialogBatch || !value) return;
    setCheckingStudent(true);
    try {
      const conflicts = await batchService.checkStudentConflicts(value, studentDialogBatch.id);
      setStudentConflicts(conflicts);
    } catch (e: any) {
      // soft-fail
    } finally {
      setCheckingStudent(false);
    }
  };

  const handleAddStudent = async () => {
    if (!studentDialogBatch || !selectedStudent) return;
    if (studentCount >= studentDialogBatch.max_students) {
      toast.error(`Maximum ${studentDialogBatch.max_students} students reached`);
      return;
    }
    // Final re-check on submit
    try {
      const conflicts = await batchService.checkStudentConflicts(selectedStudent, studentDialogBatch.id);
      if (conflicts.length > 0) {
        setStudentConflicts(conflicts);
        toast.error('One or more students are already assigned to another batch during the selected time slot.');
        return;
      }
    } catch (_e) { /* if check fails, fall through to attempt add */ }
    try {
      await batchService.addStudent(studentDialogBatch.id, selectedStudent);
      toast.success('Student added');
      setSelectedStudent(''); setStudentConflicts([]);
      await openStudentDialog(studentDialogBatch);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!studentDialogBatch) return;
    try {
      await batchService.removeStudent(studentDialogBatch.id, studentId);
      toast.success('Student removed');
      await openStudentDialog(studentDialogBatch);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Batches</h1><p className="text-muted-foreground text-sm">Loading...</p></div>
      <CardGridSkeleton count={6} />
    </div>
  );

  // batch_students.student_id stores the auth user_id
  const enrolledIds = new Set(enrolledStudents.map(e => e.student_id));
  const availableStudents = students.filter(s => !enrolledIds.has(s.user_id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Batches</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? 'Manage batches, assign teachers & students' : 'Your assigned batches'}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Batch</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Batch</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Course</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Batch Name</Label>
                  <Input value={batchName} onChange={e => setBatchName(e.target.value)} maxLength={200} placeholder="e.g. Batch A - Morning" />
                </div>
                <div>
                  <Label>Max Students (1-100)</Label>
                  <Input type="number" min={1} max={100} value={maxStudents} onChange={e => setMaxStudents(Number(e.target.value))} />
                </div>
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Schedule</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={startDate}
                        onChange={e => { setStartDate(e.target.value); recheckCreateConflicts({ date: e.target.value }); }} />
                    </div>
                    <div>
                      <Label>Start Time</Label>
                      <Input type="time" value={startTime}
                        onChange={e => { setStartTime(e.target.value); recheckCreateConflicts({ sTime: e.target.value }); }} />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input type="time" value={endTime}
                        onChange={e => { setEndTime(e.target.value); recheckCreateConflicts({ eTime: e.target.value }); }} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label>Repeats weekly on</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => {
                        const active = weekdays.includes(idx) || (weekdays.length === 0 && !!startDate && new Date(startDate + 'T00:00:00').getDay() === idx);
                        return (
                          <button key={d} type="button" onClick={() => toggleWeekday(idx)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-accent'}`}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Defaults to the day of the start date.</p>
                  </div>
                </div>
                <div>
                  <Label>Assign Teacher (optional)</Label>
                  <Select value={createTeacher} onValueChange={(v) => { setCreateTeacher(v); recheckCreateConflicts({ teacher: v }); }}>
                    <SelectTrigger><SelectValue placeholder="No teacher" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No teacher</SelectItem>
                      {createTeacherList.map(t => (
                        <SelectItem key={t.user_id} value={t.user_id}>
                          {t.display_name || t.email || t.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {checkingCreate && <p className="text-xs text-muted-foreground mt-1">Checking schedule conflicts…</p>}
                  <div className="mt-2">
                    <ConflictBanner title="Teacher already has another batch at this time" conflicts={createConflicts} />
                  </div>
                </div>
                <Button onClick={handleCreateBatch} disabled={createMutation.isPending || createConflicts.length > 0} className="w-full">
                  {createMutation.isPending ? 'Creating...' : 'Create Batch'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Layers className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No batches yet.{isAdmin ? ' Create one to get started.' : ''}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map(b => (
            <Card key={b.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{b.name}</CardTitle>
                    <CardDescription>{(b as any).courses?.name ?? 'Unknown course'}</CardDescription>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(b)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <Badge variant="secondary">Max {b.max_students}</Badge>
                  {(b as any).courses?.delivery_mode === 'offline' ? (
                    <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" /> Offline</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1"><Wifi className="h-3 w-3" /> Online</Badge>
                  )}
                  {typeof (b as any).enrolled_count === 'number' && (
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" /> {(b as any).enrolled_count}/{b.max_students}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Teacher: {(b as any).teacher_name
                    ? (b as any).teacher_name
                    : (b.teacher_id ? 'Assigned' : 'None')}
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openTeacherDialog(b.id)}>
                      <UserPlus className="mr-1 h-3 w-3" /> Teacher
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openStudentDialog(b)}>
                      <Users className="mr-1 h-3 w-3" /> Students
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Batch Dialog */}
      <Dialog open={!!editBatch} onOpenChange={v => { if (!v) setEditBatch(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Batch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Batch Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label>Max Students (1-100)</Label>
              <Input type="number" min={1} max={100} value={editMaxStudents} onChange={e => setEditMaxStudents(Number(e.target.value))} />
            </div>
            <Button onClick={handleEditBatch} disabled={editMutation.isPending} className="w-full">
              {editMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Teacher Dialog */}
      <Dialog open={!!teacherDialogBatch} onOpenChange={v => { if (!v) setTeacherDialogBatch(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Teacher</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedTeacher} onValueChange={onTeacherChange}>
              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No teacher</SelectItem>
                {teachers.map(t => (
                  <SelectItem key={t.user_id} value={t.user_id}>
                    {t.display_name || t.email || t.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {checkingTeacher && <p className="text-xs text-muted-foreground">Checking schedule conflicts…</p>}
            <ConflictBanner
              title="Teacher already has another batch assigned for the selected time slot. Please choose another teacher or time slot."
              conflicts={teacherConflicts}
            />
            <Button
              onClick={() => assignTeacherMutation.mutate()}
              disabled={assignTeacherMutation.isPending || checkingTeacher || teacherConflicts.length > 0}
              className="w-full"
            >
              {assignTeacherMutation.isPending ? 'Saving...' : teacherConflicts.length > 0 ? 'Resolve conflicts to continue' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog open={!!studentDialogBatch} onOpenChange={v => { if (!v) setStudentDialogBatch(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Manage Students
              <Badge variant="outline" className="ml-2">{studentCount}/{studentDialogBatch?.max_students ?? 25}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedStudent} onValueChange={onStudentChange}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select student to add" /></SelectTrigger>
                <SelectContent>
                  {availableStudents.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.display_name || s.email || s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddStudent}
                disabled={!selectedStudent || checkingStudent || studentConflicts.length > 0 || studentCount >= (studentDialogBatch?.max_students ?? 25)}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            {checkingStudent && <p className="text-xs text-muted-foreground">Checking schedule conflicts…</p>}
            <ConflictBanner
              title="This student is already assigned to another batch during the selected time slot."
              conflicts={studentConflicts}
            />

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {enrolledStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No students enrolled</p>
              ) : (
                enrolledStudents.map(e => (
                  <div key={e.student_id} className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">{e.display_name || e.email || e.student_id}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveStudent(e.student_id)}>
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
