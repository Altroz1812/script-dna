import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Video, CreditCard, ArrowRight, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerRow, ShimmerCard } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function ParentHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['parent_dashboard', profile?.id],
    queryFn: async () => {
      const { data: links } = await supabase.from('parent_children').select('child_id').eq('parent_id', profile!.id);
      const childIds = (links || []).map((l) => l.child_id);
      if (!childIds.length) return { children: [], payments: [], upcomingClasses: [] };
      const [profilesRes, progressRes, paymentsRes, classesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, email, avatar_url').in('user_id', childIds),
        supabase.from('student_progress').select('student_id, completion_pct').in('student_id', childIds),
        supabase.from('payments').select('*').order('payment_date', { ascending: false }).limit(5),
        supabase
          .from('live_classes')
          .select('id, title, scheduled_at, status')
          .in('status', ['scheduled', 'live'])
          .order('scheduled_at', { ascending: true })
          .limit(5),
      ]);
      const children = (profilesRes.data || []).map((p: any) => {
        const progs = (progressRes.data || []).filter((pr: any) => pr.student_id === p.user_id);
        const avg = progs.length
          ? Math.round(progs.reduce((s: number, pr: any) => s + (pr.completion_pct || 0), 0) / progs.length)
          : 0;
        return { id: p.user_id, name: p.display_name || p.email || 'Child', avatar: p.avatar_url, avg };
      });
      return { children, payments: paymentsRes.data || [], upcomingClasses: classesRes.data || [] };
    },
    enabled: !!profile,
    staleTime: 1000 * 60 * 2,
  });

  const totalPaid = (data?.payments || [])
    .filter((p: any) => p.status === 'paid')
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  return (
    <MobilePage onRefresh={async () => { await refetch(); }}>
      <div>
        <div className="text-xs text-muted-foreground">Parent dashboard</div>
        <h1 className="text-xl font-semibold font-display mt-0.5">
          Hi, {profile?.displayName?.split(' ')[0] || 'Parent'}
        </h1>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground/90 mb-2">Children</h2>
        {isLoading ? (
          <div className="space-y-2"><ShimmerRow /><ShimmerRow /></div>
        ) : !data?.children?.length ? (
          <EmptyState icon={Users} title="No children linked" message="Contact your school to link your children." />
        ) : (
          <div className="space-y-3">
            {data.children.map((c) => (
              <TouchPress
                key={c.id}
                onClick={() => navigate('/child-progress')}
                className="w-full rounded-2xl p-4 bg-card border border-white/[0.06] text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-sm font-semibold">
                    {c.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.avg}% completion</div>
                  </div>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                    style={{ width: `${c.avg}%` }}
                  />
                </div>
              </TouchPress>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground/90">Upcoming Classes</h2>
          <TouchPress onClick={() => navigate('/live-classes')} className="text-xs text-primary">See all</TouchPress>
        </div>
        {!data?.upcomingClasses?.length ? (
          <EmptyState icon={Video} title="No upcoming classes" />
        ) : (
          <div className="space-y-2">
            {data.upcomingClasses.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Video className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(c.scheduled_at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground/90">Payments</h2>
          <TouchPress onClick={() => navigate('/payments')} className="text-xs text-primary">See all</TouchPress>
        </div>
        {isLoading ? (
          <ShimmerCard />
        ) : (
          <TouchPress
            onClick={() => navigate('/payments')}
            className="w-full rounded-2xl p-4 bg-gradient-to-br from-accent/20 to-primary/10 border border-white/[0.08] flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-base">{formatINR(totalPaid)}</div>
              <div className="text-[11px] text-muted-foreground">Paid (recent)</div>
            </div>
            <ArrowRight className="w-4 h-4" />
          </TouchPress>
        )}
      </section>
    </MobilePage>
  );
}