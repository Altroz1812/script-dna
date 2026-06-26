import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, TrendingUp, FileCheck, Brain, Target, BarChart3, Award, Download, Eye } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/loading-skeletons';
import { useIsMobileApp } from '@/hooks/useIsMobileApp';
import MobileStudentProgressPage from './mobile/MobileStudentProgressPage';
import { Button } from '@/components/ui/button';
import { downloadCertificate } from '@/services/certificateService';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type CourseStatus = { label: 'Completed' | 'Needs Improvement' | 'Not Completed'; className: string };
function deriveCourseStatus(p: any): CourseStatus {
  const s = String(p?.status || '').toLowerCase();
  if (s === 'completed') return { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
  if (s === 'needs_improvement' || s === 'needs improvement') return { label: 'Needs Improvement', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
  return { label: 'Not Completed', className: 'bg-muted text-muted-foreground border-border' };
}

export default function StudentProgressPage() {
  const __isMobile = useIsMobileApp();
  if (__isMobile) return <MobileStudentProgressPage />;
  const { profile } = useAuth();

  const { data: progress = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['student_progress', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_progress')
        .select('*, courses(name, language, writing_style)')
        .eq('student_id', profile!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: submissions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ['student_submissions_scores', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_submissions')
        .select('score, status, created_at, practice_assignments(title)')
        .eq('student_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: certificates = [], isLoading: loadingCerts } = useQuery({
    queryKey: ['student_certificates', profile?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('certificates')
        .select('id, student_name, course_name, course_duration, completion_date, issued_at, status')
        .eq('student_id', profile!.id)
        .order('issued_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; student_name: string; course_name: string;
        course_duration: string | null; completion_date: string | null;
        issued_at: string; status: string;
      }>;
    },
    enabled: !!profile,
  });

  const [previewCert, setPreviewCert] = useState<{ name: string; course: string; duration: string | null; date: string | null } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const reviewedSubs = submissions.filter((s: any) => s.status === 'reviewed' && s.score != null);
  const avgScore = reviewedSubs.length > 0
    ? Math.round(reviewedSubs.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / reviewedSubs.length)
    : null;
  const totalSubmissions = submissions.length;
  const reviewedCount = reviewedSubs.length;

  const isLoading = loadingProgress || loadingSubs;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Progress</h1>
        <p className="text-muted-foreground text-sm">Track your learning journey and scores</p>
      </div>

      {isLoading ? <CardGridSkeleton count={4} /> : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{progress.length}</p>
                  <p className="text-xs text-muted-foreground">Courses</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <FileCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalSubmissions}</p>
                  <p className="text-xs text-muted-foreground">Submissions</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{avgScore != null ? `${avgScore}%` : '—'}</p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{reviewedCount}</p>
                  <p className="text-xs text-muted-foreground">Reviewed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Course Progress */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Course Progress</h2>
            {progress.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <BookOpen className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>No course progress recorded yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {progress.map((p: any) => {
                  const st = deriveCourseStatus(p);
                  return (
                  <Card key={p.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{(p as any).courses?.name || 'Course'}</CardTitle>
                        <Badge variant="outline" className={`text-xs ${st.className}`}>
                          {st.label}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {p.sessions_attended}/{p.total_sessions} sessions attended
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Completion</span>
                          <span className="font-medium text-foreground">{Math.round(p.completion_pct)}%</span>
                        </div>
                        <Progress value={p.completion_pct} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Scores */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Recent Scores</h2>
            {reviewedSubs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>No scored submissions yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {reviewedSubs.slice(0, 10).map((s: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {s.practice_assignments?.title || 'Submission'}
                      </span>
                      <Badge variant={s.score >= 70 ? 'default' : 'secondary'} className="text-sm">
                        {s.score}/100
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* AI Evaluation Coming Soon */}
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Brain className="mx-auto h-10 w-10 mb-3 text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground mb-1">AI Evaluation — Coming Soon</h3>
              <p className="text-sm text-muted-foreground">
                OCR recognition, handwriting comparison, and trace overlay feedback will be available here.
              </p>
            </CardContent>
          </Card>

          {/* Certificates */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-500" /> Certificates
            </h2>
            {loadingCerts ? (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading certificates…</CardContent></Card>
            ) : certificates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Award className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p>No certificates issued yet. Complete a course to earn one.</p>
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
                          <CardDescription className="text-xs">
                            Issued {new Date(c.issued_at).toLocaleDateString('en-IN')}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
                          <Award className="h-3 w-3 mr-1" /> Certified
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      {(c.course_duration || c.completion_date) && (
                        <div className="w-full text-[11px] text-muted-foreground mb-1">
                          {c.course_duration && <span>{c.course_duration}</span>}
                          {c.course_duration && c.completion_date && <span> · </span>}
                          {c.completion_date && <span>Completed {new Date(c.completion_date).toLocaleDateString('en-IN')}</span>}
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewCert({ name: c.student_name, course: c.course_name, duration: c.course_duration, date: c.completion_date })}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                      </Button>
                      <Button
                        size="sm"
                        disabled={downloadingId === c.id}
                        onClick={async () => {
                          setDownloadingId(c.id);
                          try {
                            await downloadCertificate(c.student_name, c.course_name, {
                              duration: c.course_duration,
                              completionDate: c.completion_date,
                            });
                          } catch (e: any) {
                            console.error(e);
                          } finally {
                            setDownloadingId(null);
                          }
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
          </div>

          <Dialog open={!!previewCert} onOpenChange={(o) => !o && setPreviewCert(null)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Certificate Preview</DialogTitle>
              </DialogHeader>
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
        </>
      )}
    </div>
  );
}
