import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { toast } from 'sonner';
import { TrendingUp, BookOpen, ClipboardCheck, Video, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadCertificate } from '@/services/certificateService';
import { Eye, Download } from 'lucide-react';

type CourseStatus = { label: 'Completed' | 'Needs Improvement' | 'Not Completed'; className: string };
function deriveCourseStatus(p: any): CourseStatus {
  const s = String(p?.status || '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
  if (s === 'needs_improvement' || s === 'needs improvement') return { label: 'Needs Improvement', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
  return { label: 'Not Completed', className: 'bg-muted text-muted-foreground border-border' };
}

export default function ParentProgressPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [selectedChild, setSelectedChild] = useState(searchParams.get('child') || '');
  const [progress, setProgress] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [previewCert, setPreviewCert] = useState<{ name: string; course: string; duration: string | null; date: string | null } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load children list
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: links } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', profile.id);
      if (!links || links.length === 0) { setChildren([]); setLoading(false); return; }
      const childIds = links.map(l => l.child_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', childIds);
      const list = (profiles || []).map(p => ({ id: p.user_id, name: p.display_name || p.email || p.user_id }));
      setChildren(list);
      if (!selectedChild && list.length > 0) setSelectedChild(list[0].id);
      setLoading(false);
    })();
  }, [profile]);

  // Load child data when selected
  useEffect(() => {
    if (!selectedChild) return;
    setSearchParams({ child: selectedChild });
    loadChildData(selectedChild);
  }, [selectedChild]);

  const loadChildData = async (childId: string) => {
    setLoading(true);
    try {
      const [progRes, subRes, attRes, classRes, certRes] = await Promise.all([
        supabase.from('student_progress').select('*, courses(name)').eq('student_id', childId),
        supabase.from('student_submissions').select('*, practice_assignments(title, batch_id)').eq('student_id', childId).order('created_at', { ascending: false }).limit(20),
        supabase.from('attendance').select('*, batches(name)').eq('student_id', childId).order('date', { ascending: false }).limit(30),
        supabase.from('live_classes').select('id, title, scheduled_at, status, batches(name)').in('status', ['scheduled', 'live']).order('scheduled_at', { ascending: true }).limit(10),
        (supabase as any).from('certificates').select('id, student_name, course_name, course_duration, completion_date, issued_at, status').eq('student_id', childId).order('issued_at', { ascending: false }),
      ]);
      setProgress(progRes.data || []);
      setSubmissions(subRes.data || []);
      setAttendance(attRes.data || []);
      setUpcomingClasses(classRes.data || []);
      setCertificates(certRes.data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const childName = children.find(c => c.id === selectedChild)?.name || 'Child';
  const avgCompletion = progress.length
    ? Math.round(progress.reduce((s, p) => s + (p.completion_pct || 0), 0) / progress.length)
    : 0;
  const avgScore = submissions.filter(s => s.score != null).length
    ? Math.round(submissions.filter(s => s.score != null).reduce((s, sub) => s + sub.score, 0) / submissions.filter(s => s.score != null).length)
    : null;
  const attendanceRate = attendance.length
    ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)
    : null;
  const completedCourses = progress.filter(p => p.status === 'completed');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-foreground">Child Progress</h1>
        {children.length > 1 && (
          <Select value={selectedChild} onValueChange={setSelectedChild}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select child" /></SelectTrigger>
            <SelectContent>
              {children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? <TableSkeleton columns={4} rows={4} /> : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Completion', value: `${avgCompletion}%`, icon: TrendingUp, color: 'text-primary' },
              { label: 'Avg Score', value: avgScore != null ? `${avgScore}/100` : '—', icon: Award, color: 'text-emerald-500' },
              { label: 'Attendance', value: attendanceRate != null ? `${attendanceRate}%` : '—', icon: ClipboardCheck, color: 'text-orange-500' },
              { label: 'Courses', value: progress.length, icon: BookOpen, color: 'text-blue-500' },
            ].map(c => (
              <Card key={c.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <c.icon className={`w-8 h-8 ${c.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{c.value}</p>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="courses" className="space-y-4">
            <TabsList>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="classes">Upcoming Classes</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
            </TabsList>

            <TabsContent value="courses">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Status</TableHead><TableHead>Completion</TableHead><TableHead>Sessions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {progress.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No course data</TableCell></TableRow>
                    ) : progress.map(p => {
                      const st = deriveCourseStatus(p);
                      return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{(p as any).courses?.name || p.course_id}</TableCell>
                        <TableCell><Badge variant="outline" className={st.className}>{st.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${p.completion_pct}%` }} />
                            </div>
                            <span className="text-sm">{p.completion_pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{p.sessions_attended}/{p.total_sessions}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="submissions">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Assignment</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead><TableHead>Feedback</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {submissions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No submissions</TableCell></TableRow>
                    ) : submissions.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{(s as any).practice_assignments?.title || s.assignment_id}</TableCell>
                        <TableCell><Badge variant={s.status === 'reviewed' ? 'default' : 'secondary'}>{s.status}</Badge></TableCell>
                        <TableCell>{s.score != null ? `${s.score}/100` : '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{s.teacher_feedback || '—'}</TableCell>
                        <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="attendance">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Batch</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {attendance.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No attendance records</TableCell></TableRow>
                    ) : attendance.map(a => (
                      <TableRow key={a.id}>
                        <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                        <TableCell>{(a as any).batches?.name || a.batch_id}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === 'present' ? 'default' : a.status === 'late' ? 'secondary' : 'destructive'}>
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="classes">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Batch</TableHead><TableHead>Scheduled</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {upcomingClasses.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No upcoming classes</TableCell></TableRow>
                    ) : upcomingClasses.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell>{(c as any).batches?.name || ''}</TableCell>
                        <TableCell>{new Date(c.scheduled_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={c.status === 'live' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="certificates">
              {certificates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Award className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No certificates issued yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Certificates appear here once the teacher marks the course completed.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {certificates.map((c) => (
                    <Card key={c.id} className="border-emerald-500/30 bg-emerald-500/5">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">{c.course_name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {c.course_duration && <>{c.course_duration} · </>}
                              Completed {new Date(c.completion_date || c.issued_at).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
                            <Award className="h-3 w-3 mr-1" /> Certified
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPreviewCert({ name: c.student_name, course: c.course_name, duration: c.course_duration, date: c.completion_date })}>
                          <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                        </Button>
                        <Button
                          size="sm"
                          disabled={downloadingId === c.id}
                          onClick={async () => {
                            setDownloadingId(c.id);
                            try {
                              await downloadCertificate(c.student_name, c.course_name, { duration: c.course_duration, completionDate: c.completion_date });
                            } catch (e: any) { console.error(e); } finally { setDownloadingId(null); }
                          }}
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          {downloadingId === c.id ? 'Generating…' : 'Download'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <Dialog open={!!previewCert} onOpenChange={(o) => !o && setPreviewCert(null)}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader><DialogTitle>Certificate Preview</DialogTitle></DialogHeader>
                  {previewCert && (
                    <div className="relative w-full">
                      <img src="/certificate.jpeg" alt="Certificate" className="w-full h-auto" />
                      <div className="absolute left-[5%] right-[5%] top-[55%] text-[#2c3e50] font-serif font-bold uppercase text-xl md:text-3xl">
                        {previewCert.name}
                      </div>
                      <div className="absolute left-[5%] right-[5%] top-[74%] text-[#555] font-serif italic text-base md:text-2xl">
                        {previewCert.course}
                      </div>
                      <div className="absolute left-[5%] right-[5%] top-[86%] text-[#333] font-serif text-[11px] md:text-sm">
                        {previewCert.duration && <>Duration: {previewCert.duration}    •    </>}
                        Date of Completion: {previewCert.date ? new Date(previewCert.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
