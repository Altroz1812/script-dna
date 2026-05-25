import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, NotebookPen, FileCheck, TrendingUp, Video, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerCard, ShimmerRing, ShimmerRow } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { useTodayClasses } from '@/hooks/useTodayClasses';

function ProgressRing({ pct }: { pct: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} stroke="hsl(var(--muted))" strokeWidth="10" fill="none" opacity="0.4" />
        <circle
          cx="70"
          cy="70"
          r={r}
          stroke="url(#g)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.4,1.2,.4,1)' }}
        />
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold font-display text-gradient">{pct}%</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">Complete</div>
      </div>
    </div>
  );
}

export default function StudentHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data: todayClasses = [], refetch: refetchToday } = useTodayClasses();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['student_dashboard', profile?.id],
    queryFn: async () => {
      const [enrollRes, subRes, progressRes] = await Promise.all([
        supabase
          .from('batch_students')
          .select('batch_id, batches(name, courses(name))')
          .eq('student_id', profile!.id),
        supabase
          .from('student_submissions')
          .select('id, status, score, created_at, practice_assignments(title)')
          .eq('student_id', profile!.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('student_progress').select('completion_pct').eq('student_id', profile!.id),
      ]);
      return {
        enrollments: enrollRes.data || [],
        recentSubmissions: subRes.data || [],
        progress: progressRes.data || [],
      };
    },
    enabled: !!profile,
    staleTime: 1000 * 60 * 2,
  });

  const avg = data?.progress?.length
    ? Math.round(data.progress.reduce((s: number, p: any) => s + (p.completion_pct || 0), 0) / data.progress.length)
    : 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const quickActions = [
    { label: 'Practice', icon: NotebookPen, path: '/practice', tint: 'from-emerald-400/30 to-emerald-600/10' },
    { label: 'Submit', icon: FileCheck, path: '/submissions', tint: 'from-orange-400/30 to-orange-600/10' },
    { label: 'Courses', icon: BookOpen, path: '/courses', tint: 'from-primary/30 to-primary/5' },
    { label: 'Progress', icon: TrendingUp, path: '/my-progress', tint: 'from-accent/30 to-accent/5' },
  ];

  return (
    <MobilePage onRefresh={async () => { await Promise.all([refetch(), refetchToday()]); }}>
      <div className="flex items-center gap-3 animate-fade-in">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{greeting}</div>
          <div className="text-lg font-semibold font-display truncate max-w-[60vw]">
            {profile?.displayName?.split(' ')[0] || 'Learner'}
          </div>
        </div>
      </div>

      <div className="rounded-3xl p-5 bg-gradient-to-br from-primary/15 via-card to-accent/10 border border-white/[0.08] flex items-center gap-4">
        {isLoading ? (
          <ShimmerRing />
        ) : (
          <ProgressRing pct={avg} />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Overall</div>
          <div className="text-base font-semibold mt-0.5">Your learning journey</div>
          <div className="text-xs text-muted-foreground mt-1">
            {data?.enrollments?.length || 0} courses · {data?.recentSubmissions?.length || 0} recent submissions
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground/90">Today's Classes</h2>
          <TouchPress onClick={() => navigate('/live-classes')} className="text-xs text-primary">See all</TouchPress>
        </div>
        {todayClasses.length === 0 ? (
          <EmptyState icon={Video} title="No classes today" message="Enjoy a break or revisit past lessons." />
        ) : (
          <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory">
            {(todayClasses as any[]).slice(0, 6).map((c) => (
              <TouchPress
                key={c.id}
                onClick={() => navigate('/live-classes')}
                className="snap-start min-w-[78vw] rounded-2xl p-4 bg-card border border-white/[0.06] text-left"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${c.status === 'live' ? 'bg-success animate-pulse' : 'bg-primary'}`} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.status}</span>
                </div>
                <div className="font-semibold mt-2 truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </TouchPress>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground/90 mb-2">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((a) => (
            <TouchPress
              key={a.label}
              onClick={() => navigate(a.path)}
              className={`h-24 rounded-2xl p-4 bg-gradient-to-br ${a.tint} border border-white/[0.08] flex flex-col justify-between text-left`}
            >
              <a.icon className="w-5 h-5 text-foreground" />
              <div className="font-semibold text-sm">{a.label}</div>
            </TouchPress>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground/90">Recent Submissions</h2>
          <TouchPress onClick={() => navigate('/submissions')} className="text-xs text-primary">See all</TouchPress>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <ShimmerRow /><ShimmerRow /><ShimmerRow />
          </div>
        ) : !data?.recentSubmissions?.length ? (
          <EmptyState icon={FileCheck} title="No submissions yet" message="Complete an assignment to see it here." />
        ) : (
          <div className="space-y-2">
            {data.recentSubmissions.map((s: any) => (
              <TouchPress
                key={s.id}
                onClick={() => navigate('/submissions')}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-white/[0.06] text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.practice_assignments?.title || 'Submission'}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{s.status}{s.score != null ? ` · ${s.score}` : ''}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </TouchPress>
            ))}
          </div>
        )}
      </section>
    </MobilePage>
  );
}