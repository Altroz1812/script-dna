import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Video, ClipboardCheck, FileCheck, Plus, BookOpen, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerStat, ShimmerRow } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { FAB } from '@/components/mobile/ui/FAB';
import { useTodayClasses } from '@/hooks/useTodayClasses';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export default function TeacherHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const { data: todayClasses = [], refetch: refetchToday } = useTodayClasses();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['teacher_dashboard', profile?.id],
    queryFn: async () => {
      const [batchRes, classRes, assignRes] = await Promise.all([
        supabase.from('batches').select('id, name, batch_students(id)').eq('teacher_id', profile!.id),
        supabase
          .from('live_classes')
          .select('id, title, scheduled_at, status, batch_id')
          .in('status', ['scheduled', 'live'])
          .order('scheduled_at', { ascending: true })
          .limit(10),
        supabase.from('practice_assignments').select('id').eq('teacher_id', profile!.id),
      ]);
      const batches = batchRes.data || [];
      const studentCount = batches.reduce((s: number, b: any) => s + (b.batch_students?.length || 0), 0);
      const assignmentIds = (assignRes.data || []).map((a) => a.id);
      let pending = 0;
      if (assignmentIds.length) {
        const { data: subs } = await supabase
          .from('student_submissions')
          .select('id')
          .eq('status', 'pending')
          .in('assignment_id', assignmentIds as any);
        pending = (subs || []).length;
      }
      return {
        batchCount: batches.length,
        studentCount,
        upcomingClasses: classRes.data || [],
        pending,
      };
    },
    enabled: !!profile,
    staleTime: 1000 * 60 * 2,
  });

  const liveClass = (todayClasses as any[]).find((c) => c.status === 'live');

  const stats = [
    { label: 'Active Batches', value: data?.batchCount ?? 0, icon: Users, tint: 'from-primary/30 to-primary/5' },
    { label: 'Students', value: data?.studentCount ?? 0, icon: Users, tint: 'from-emerald-400/30 to-emerald-600/5' },
    { label: "Today's Classes", value: (todayClasses as any[]).length, icon: Video, tint: 'from-cyan-400/30 to-cyan-600/5' },
    { label: 'Pending Reviews', value: data?.pending ?? 0, icon: FileCheck, tint: 'from-accent/30 to-accent/5' },
  ];

  return (
    <>
      <MobilePage onRefresh={async () => { await Promise.all([refetch(), refetchToday()]); }}>
        <div>
          <div className="text-xs text-muted-foreground">Teacher dashboard</div>
          <h1 className="text-xl font-semibold font-display mt-0.5">
            Hi, {profile?.displayName?.split(' ')[0] || 'Teacher'}
          </h1>
        </div>

        {liveClass && (
          <TouchPress
            onClick={() => navigate('/live-classes')}
            className="w-full rounded-2xl p-4 bg-gradient-to-r from-success/25 to-primary/15 border border-success/30 flex items-center gap-3 text-left animate-glow-pulse-cyan"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-success font-semibold">Live now</div>
              <div className="font-semibold truncate">{liveClass.title}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-foreground" />
          </TouchPress>
        )}

        <div className="grid grid-cols-2 gap-3">
          {isLoading
            ? [0, 1, 2, 3].map((i) => <ShimmerStat key={i} />)
            : stats.map((s) => (
                <div
                  key={s.label}
                  className={`rounded-2xl p-4 bg-gradient-to-br ${s.tint} border border-white/[0.08]`}
                >
                  <s.icon className="w-5 h-5 text-foreground" />
                  <div className="text-2xl font-bold font-display mt-3">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
        </div>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground/90">Upcoming Classes</h2>
            <TouchPress onClick={() => navigate('/live-classes')} className="text-xs text-primary">See all</TouchPress>
          </div>
          {!data?.upcomingClasses?.length ? (
            <EmptyState icon={Video} title="No classes scheduled" actionLabel="Schedule" onAction={() => navigate('/schedule')} />
          ) : (
            <div className="space-y-2">
              {data.upcomingClasses.slice(0, 5).map((c: any) => (
                <TouchPress
                  key={c.id}
                  onClick={() => navigate('/live-classes')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-white/[0.06] text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/15 flex items-center justify-center">
                    <Video className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(c.scheduled_at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground">{c.status}</span>
                </TouchPress>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground/90 mb-2">Pending Reviews</h2>
          {isLoading ? (
            <ShimmerRow />
          ) : (data?.pending ?? 0) === 0 ? (
            <EmptyState icon={ClipboardCheck} title="All caught up" message="No submissions waiting for review." />
          ) : (
            <TouchPress
              onClick={() => navigate('/submissions')}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-accent/20 to-primary/10 border border-white/[0.08] text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{data?.pending} pending</div>
                <div className="text-xs text-muted-foreground">Tap to review now</div>
              </div>
              <ArrowRight className="w-4 h-4" />
            </TouchPress>
          )}
        </section>
      </MobilePage>

      <FAB icon={Plus} label="Create" onClick={() => setFabOpen(true)} />
      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t border-white/10 pb-8">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-muted mb-4" />
          <h3 className="text-base font-semibold mb-3">Quick create</h3>
          <div className="space-y-2">
            {[
              { label: 'New Class', icon: Video, path: '/schedule' },
              { label: 'New Assignment', icon: FileCheck, path: '/practice' },
              { label: 'New Batch', icon: BookOpen, path: '/batches' },
            ].map((a) => (
              <TouchPress
                key={a.label}
                onClick={() => { setFabOpen(false); navigate(a.path); }}
                className="w-full flex items-center gap-3 h-12 px-3 rounded-xl bg-card border border-white/[0.06] text-left"
              >
                <a.icon className="w-5 h-5 text-primary" />
                <span className="font-medium">{a.label}</span>
              </TouchPress>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}