import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, TrendingUp, FileCheck, Brain, Target, BarChart3 } from 'lucide-react';
import { CardGridSkeleton } from '@/components/ui/loading-skeletons';

export default function StudentProgressPage() {
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
                {progress.map((p: any) => (
                  <Card key={p.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{(p as any).courses?.name || 'Course'}</CardTitle>
                        <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                          {p.status}
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
                ))}
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
        </>
      )}
    </div>
  );
}
