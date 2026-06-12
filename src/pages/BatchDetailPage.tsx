import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isAfter } from 'date-fns';
import { adminQuery } from '@/services/api/adminService';
import { batchService } from '@/services/api/courseService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { useIsMobileApp } from '@/hooks/useIsMobileApp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Copy, ExternalLink, Users, BookOpen, Clock, Calendar,
  CheckCircle2, Radio, Hourglass, XCircle, User as UserIcon, Mail, GraduationCap, Plus, UserPlus, Trash2, Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { CardGridSkeleton } from '@/components/ui/loading-skeletons';
import { Checkbox } from '@/components/ui/checkbox';

type Detail = {
  batch: any;
  teacher: any;
  students: Array<{ student_id: string; display_name: string | null; email: string | null; completion_pct: number }>;
  student_count: number;
  sessions: Array<{ id: string; title: string; scheduled_at: string; duration_minutes: number; status: string; meeting_url: string | null }>;
  progress: {
    total_hours: number | null; hours_completed: number; hours_pending: number | null;
    sessions_total: number; sessions_completed: number; sessions_live: number;
    sessions_upcoming: number; sessions_cancelled: number;
  };
};

function statusMeta(status: string, scheduledAt: string) {
  const t = new Date(scheduledAt);
  const now = new Date();
  if (status === 'cancelled') return { label: 'Cancelled', icon: XCircle, cls: 'bg-destructive/15 text-destructive border-destructive/30' };
  if (status === 'completed') return { label: 'Completed', icon: CheckCircle2, cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' };
  if (status === 'live') return { label: 'Live now', icon: Radio, cls: 'bg-green-500/15 text-green-500 border-green-500/30 animate-pulse' };
  if (isAfter(t, now)) return { label: 'Upcoming', icon: Hourglass, cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
  return { label: 'Scheduled', icon: Calendar, cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
}

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isAdmin } = useRBAC();
  const isMobile = useIsMobileApp();

  const isPrivileged = isAdmin;
  const queryClient = useQueryClient();
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');

  const { data: teacherOptions = [] } = useQuery({
    queryKey: ['batch_teachers_picker', batchId],
    enabled: isAdmin && teacherDialogOpen,
    queryFn: () => batchService.listTeachers(),
  });

  const { data: studentOptions = [] } = useQuery({
    queryKey: ['batch_students_picker', batchId],
    enabled: isAdmin && studentDialogOpen,
    queryFn: () => batchService.listStudents(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['batch_detail', batchId] });

  const assignTeacherMut = useMutation({
    mutationFn: () => batchService.assignTeacher(batchId!, selectedTeacher || null),
    onSuccess: () => {
      toast.success('Teacher assigned');
      setTeacherDialogOpen(false); setSelectedTeacher(''); invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to assign teacher'),
  });

  const addStudentMut = useMutation({
    mutationFn: () => batchService.addStudent(batchId!, selectedStudent),
    onSuccess: () => {
      toast.success('Student added');
      setSelectedStudent(''); invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to add student'),
  });

  const removeStudentMut = useMutation({
    mutationFn: (studentId: string) => batchService.removeStudent(batchId!, studentId),
    onSuccess: () => { toast.success('Student removed'); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Failed to remove student'),
  });

  // ---- Certificates ----
  const { data: certificates = [] } = useQuery({
    queryKey: ['batch_certificates', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('certificates')
        .select('id, student_id, issued_at, status')
        .eq('batch_id', batchId!);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; student_id: string; issued_at: string; status: string }>;
    },
  });
  const issuedIds = useMemo(() => new Set(certificates.map((c) => c.student_id)), [certificates]);
  const [selectedForCert, setSelectedForCert] = useState<Set<string>>(new Set());
  const toggleCertStudent = (id: string) => {
    setSelectedForCert((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const issueCertsMut = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('Batch not loaded');
      const toIssue = data.students.filter(
        (s) => selectedForCert.has(s.student_id) && !issuedIds.has(s.student_id),
      );
      if (toIssue.length === 0) throw new Error('No new students selected');
      const rows = toIssue.map((s) => ({
        student_id: s.student_id,
        batch_id: data.batch.id,
        course_id: data.batch.course_id,
        organization_id: data.batch.organization_id,
        student_name: s.display_name || s.email || 'Student',
        course_name: data.batch.courses?.name || 'Course',
        issued_by: profile?.id ?? null,
        status: 'issued',
      }));
      const { error } = await (supabase as any).from('certificates').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} certificate${n === 1 ? '' : 's'} issued`);
      setSelectedForCert(new Set());
      queryClient.invalidateQueries({ queryKey: ['batch_certificates', batchId] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to issue certificates'),
  });

  const { data, isLoading } = useQuery<Detail>({
    queryKey: ['batch_detail', batchId],
    enabled: !!batchId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (isPrivileged) {
        return (await adminQuery('get_batch_detail', { id: batchId })) as Detail;
      }
      // RLS-path for teacher / student / parent: read directly
      const { data: batch } = await supabase
        .from('batches').select('*, courses(*)').eq('id', batchId!).maybeSingle();
      if (!batch) throw new Error('Batch not found');
      let teacher: any = null;
      if (batch.teacher_id) {
        const { data: t } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, avatar_url')
          .eq('user_id', batch.teacher_id).maybeSingle();
        teacher = t || null;
      }
      const { data: bs } = await supabase
        .from('batch_students').select('student_id, enrolled_at').eq('batch_id', batchId!);
      const sIds = (bs ?? []).map((r: any) => r.student_id);
      let profs: any[] = [];
      let progs: any[] = [];
      if (sIds.length) {
        const [p, pr] = await Promise.all([
          supabase.from('profiles').select('user_id, display_name, email').in('user_id', sIds),
          supabase.from('student_progress').select('student_id, completion_pct').eq('batch_id', batchId!),
        ]);
        profs = p.data ?? []; progs = pr.data ?? [];
      }
      const pm: Record<string, any> = {}; for (const p of profs) pm[p.user_id] = p;
      const gm: Record<string, any> = {}; for (const p of progs) gm[p.student_id] = p;
      const students = (bs ?? []).map((r: any) => ({
        student_id: r.student_id,
        display_name: pm[r.student_id]?.display_name || null,
        email: pm[r.student_id]?.email || null,
        completion_pct: gm[r.student_id]?.completion_pct ?? 0,
      }));
      const { data: sessions } = await supabase
        .from('live_classes')
        .select('id, title, scheduled_at, duration_minutes, status, meeting_url')
        .eq('batch_id', batchId!)
        .order('scheduled_at', { ascending: true });
      const sList = sessions ?? [];
      const completedMin = sList.filter((s: any) => s.status === 'completed').reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
      const totalHours = batch.courses?.total_hours ?? null;
      const hoursCompleted = +(completedMin / 60).toFixed(1);
      const hoursPending = totalHours != null ? Math.max(0, +(totalHours - hoursCompleted).toFixed(1)) : null;
      return {
        batch, teacher, students, student_count: students.length, sessions: sList,
        progress: {
          total_hours: totalHours, hours_completed: hoursCompleted, hours_pending: hoursPending,
          sessions_total: sList.length,
          sessions_completed: sList.filter((s: any) => s.status === 'completed').length,
          sessions_live: sList.filter((s: any) => s.status === 'live').length,
          sessions_upcoming: sList.filter((s: any) => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date()).length,
          sessions_cancelled: sList.filter((s: any) => s.status === 'cancelled').length,
        },
      } as Detail;
    },
  });

  const meetingLink = useMemo(() => {
    const room = data?.batch?.meeting_room;
    if (!room) return null;
    return `${window.location.origin}/live-classes?room=${encodeURIComponent(room)}`;
  }, [data?.batch?.meeting_room]);

  const copyLink = () => {
    if (!meetingLink) return;
    navigator.clipboard.writeText(meetingLink);
    toast.success('Meeting link copied');
  };

  if (isLoading || !data) {
    return (
      <div className={isMobile ? 'p-4 space-y-4' : 'p-6 space-y-6'}>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <CardGridSkeleton count={4} />
      </div>
    );
  }

  const { batch, teacher, students, sessions, progress } = data;
  const course = batch.courses || {};

  return (
    <div className={isMobile ? 'p-4 space-y-4 pb-24' : 'p-6 space-y-6 max-w-6xl mx-auto'}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{batch.name}</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
          <BookOpen className="h-4 w-4" /> {course.name || '—'}
          {course.total_hours != null && <span>· {course.total_hours}h total</span>}
          {course.duration_days != null && <span>· {course.duration_days} sessions</span>}
        </p>
      </div>

      {/* Meeting link card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" /> Permanent Meeting Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 border border-border/60 font-mono text-xs break-all">
            {meetingLink || 'Not configured'}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={copyLink} disabled={!meetingLink}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />Copy
            </Button>
            <Button size="sm" onClick={() => navigate('/live-classes')} disabled={!meetingLink}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Open in Live Classes
            </Button>
            {batch.meeting_link_expires_at && (
              <span className="text-xs text-muted-foreground">
                Valid till {format(parseISO(batch.meeting_link_expires_at), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Same link is used for every session of this batch — no new link is generated daily.
          </p>
        </CardContent>
      </Card>

      {/* Teacher + Progress grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Teacher</CardTitle>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => { setSelectedTeacher(batch.teacher_id || ''); setTeacherDialogOpen(true); }}>
                <UserPlus className="h-3.5 w-3.5 mr-1" />{teacher ? 'Change' : 'Add'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {teacher ? (
              <div className="space-y-1">
                <div className="font-medium text-sm flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  {teacher.display_name || '—'}
                </div>
                {teacher.email && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />{teacher.email}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No teacher assigned</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{progress.hours_completed}h</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {progress.hours_pending != null ? `${progress.hours_pending}h` : '—'}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{progress.sessions_completed}/{progress.sessions_total}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{data.student_count}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Students</div>
              </div>
            </div>
            {progress.total_hours != null && (
              <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                  style={{ width: `${Math.min(100, (progress.hours_completed / Math.max(1, progress.total_hours)) * 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Students */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Students ({data.student_count})</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Max {batch.max_students}</Badge>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setStudentDialogOpen(true)} disabled={data.student_count >= batch.max_students}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-xs text-muted-foreground">No students enrolled yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {students.map((s) => (
                <li key={s.student_id} className="py-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {(s.display_name || s.email || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.display_name || '—'}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{s.email}</div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground shrink-0">{Math.round(s.completion_pct ?? 0)}%</div>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeStudentMut.mutate(s.student_id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Day-wise session status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Day-wise Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sessions scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => {
                const meta = statusMeta(s.status, s.scheduled_at);
                const Icon = meta.icon;
                const dt = parseISO(s.scheduled_at);
                return (
                  <li key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(dt, 'EEE, MMM d')}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(dt, 'h:mm a')}</span>
                        <span>· {s.duration_minutes} min</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${meta.cls}`}>
                      {meta.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate(`/schedule?batch=${batch.id}`)}>
            <Calendar className="h-4 w-4 mr-1.5" /> Add Extra Session
          </Button>
        </div>
      )}

      {/* Assign Teacher Dialog */}
      <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{teacher ? 'Change Teacher' : 'Assign Teacher'}</DialogTitle>
          </DialogHeader>
          <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
            <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
            <SelectContent>
              {teacherOptions.map((t) => (
                <SelectItem key={t.user_id} value={t.user_id}>
                  {t.display_name || t.email || t.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2">
            {teacher && (
              <Button variant="ghost" onClick={() => { setSelectedTeacher(''); assignTeacherMut.mutate(); }}>
                Unassign
              </Button>
            )}
            <Button variant="outline" onClick={() => setTeacherDialogOpen(false)}>Cancel</Button>
            <Button disabled={!selectedTeacher || assignTeacherMut.isPending} onClick={() => assignTeacherMut.mutate()}>
              {assignTeacherMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
          </DialogHeader>
          <Input placeholder="Search by name or email" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
          <div className="max-h-72 overflow-y-auto space-y-1">
            {studentOptions
              .filter((s) => !students.some((es) => es.student_id === s.user_id))
              .filter((s) => {
                const q = studentSearch.toLowerCase().trim();
                if (!q) return true;
                return (s.display_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
              })
              .map((s) => (
                <button
                  key={s.user_id}
                  onClick={() => { setSelectedStudent(s.user_id); }}
                  className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${selectedStudent === s.user_id ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/40'}`}
                >
                  <div className="font-medium">{s.display_name || '—'}</div>
                  <div className="text-[11px] text-muted-foreground">{s.email}</div>
                </button>
              ))}
            {studentOptions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Loading students…</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentDialogOpen(false)}>Close</Button>
            <Button disabled={!selectedStudent || addStudentMut.isPending} onClick={() => addStudentMut.mutate()}>
              {addStudentMut.isPending ? 'Adding…' : 'Add Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}