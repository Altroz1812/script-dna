import { useQuery } from '@tanstack/react-query';
import { BookOpen, FileCheck, Brain, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerCard, ShimmerStat } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';

export default function MobileStudentProgressPage() {
  const { profile } = useAuth();

  const { data: progress = [], isLoading: lp, refetch: r1 } = useQuery({
    queryKey: ['m_progress', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_progress')
        .select('*, courses(name, language, writing_style)')
        .eq('student_id', profile!.id);
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: subs = [], isLoading: ls, refetch: r2 } = useQuery({
    queryKey: ['m_progress_subs', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_submissions')
        .select('score, status')
        .eq('student_id', profile!.id)
        .limit(50);
      return data || [];
    },
    enabled: !!profile,
  });

  const reviewed = subs.filter((s: any) => s.status === 'reviewed' && s.score != null);
  const avg = reviewed.length ? Math.round(reviewed.reduce((a: number, s: any) => a + s.score, 0) / reviewed.length) : null;

  const loading = lp || ls;

  return (
    <MobilePage onRefresh={async () => { await Promise.all([r1(), r2()]); }}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">My Progress</h1>
        <p className="text-xs text-muted-foreground mt-1">Your learning journey at a glance</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <ShimmerStat /><ShimmerStat /><ShimmerStat /><ShimmerStat />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={BookOpen} label="Courses" value={progress.length} tint="from-primary/30 to-primary/5" />
          <StatCard icon={FileCheck} label="Submitted" value={subs.length} tint="from-emerald-500/30 to-emerald-500/5" />
          <StatCard icon={Target} label="Reviewed" value={reviewed.length} tint="from-orange-500/30 to-orange-500/5" />
          <StatCard icon={Brain} label="Avg Score" value={avg != null ? `${avg}%` : '—'} tint="from-accent/30 to-accent/5" />
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-foreground/90 mb-2">Course Progress</h2>
        {loading ? (
          <div className="space-y-3"><ShimmerCard /><ShimmerCard /></div>
        ) : progress.length === 0 ? (
          <EmptyState icon={BookOpen} title="No progress yet" message="Complete lessons to see progress." />
        ) : (
          <div className="space-y-3">
            {progress.map((p: any) => (
              <div key={p.id} className="rounded-2xl p-4 bg-card border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{p.courses?.name || 'Course'}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">
                      {p.courses?.language || ''} {p.courses?.writing_style || ''}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gradient">{p.completion_pct || 0}%</div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                    style={{ width: `${Math.min(100, p.completion_pct || 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </MobilePage>
  );
}

function StatCard({ icon: Icon, label, value, tint }: any) {
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br ${tint} border border-white/[0.08]`}>
      <Icon className="w-5 h-5 text-foreground" />
      <div className="text-2xl font-bold font-display mt-2">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}