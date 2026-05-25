import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, GraduationCap, Building2, UserPlus, CreditCard, BarChart3, Bell, Activity, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { adminQuery } from '@/services/api/adminService';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerStat, ShimmerCard } from '@/components/mobile/ui/Shimmer';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { EmptyState } from '@/components/mobile/ui/EmptyState';

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function AdminHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { activeOrgId } = useActiveOrg();
  const isSuperadmin = profile?.role === 'superadmin';
  const effectiveOrgId = isSuperadmin ? activeOrgId : profile?.organizationId ?? null;

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['admin_stats', effectiveOrgId, isSuperadmin],
    queryFn: () => adminQuery('get_stats', { target_org_id: effectiveOrgId }) as Promise<any>,
    staleTime: 1000 * 60 * 5,
    enabled: !!profile,
  });

  const { data: payments, refetch: refetchPay } = useQuery({
    queryKey: ['admin_recent_payments', effectiveOrgId],
    queryFn: () => adminQuery('list_payments').catch(() => []) as Promise<any[]>,
    enabled: !!profile,
    staleTime: 1000 * 60 * 5,
  });

  const { data: activity, refetch: refetchAct } = useQuery({
    queryKey: ['admin_activity_logs', effectiveOrgId],
    queryFn: () => adminQuery('list_activity_logs').catch(() => []) as Promise<any[]>,
    enabled: !!profile,
    staleTime: 1000 * 60 * 5,
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const revenueToday = (payments || [])
    .filter((p: any) => p.status === 'paid' && new Date(p.payment_date || p.created_at) >= today)
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const revenueMonth = (payments || [])
    .filter((p: any) => p.status === 'paid' && new Date(p.payment_date || p.created_at) >= monthStart)
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const statTiles = [
    { label: 'Students', value: stats?.roleCounts?.student ?? 0, icon: GraduationCap, tint: 'from-primary/30 to-primary/5' },
    { label: 'Teachers', value: stats?.roleCounts?.teacher ?? 0, icon: Users, tint: 'from-emerald-400/30 to-emerald-600/5' },
    { label: 'Leads', value: stats?.totalLeads ?? 0, icon: UserPlus, tint: 'from-cyan-400/30 to-cyan-600/5' },
    { label: isSuperadmin ? 'Orgs' : 'Batches', value: isSuperadmin ? stats?.totalOrgs ?? 0 : stats?.totalBatches ?? 0, icon: Building2, tint: 'from-accent/30 to-accent/5' },
  ];

  const quickActions = [
    { label: 'Users', icon: Users, path: '/users' },
    { label: 'Leads', icon: UserPlus, path: '/leads' },
    { label: 'Payments', icon: CreditCard, path: '/payments' },
    { label: 'Reports', icon: BarChart3, path: '/reports' },
  ];

  return (
    <MobilePage onRefresh={async () => { await Promise.all([refetch(), refetchPay(), refetchAct()]); }}>
      <div>
        <div className="text-xs text-muted-foreground">{isSuperadmin ? 'Super admin' : 'Admin'}</div>
        <h1 className="text-xl font-semibold font-display mt-0.5">
          Hi, {profile?.displayName?.split(' ')[0] || 'Admin'}
        </h1>
      </div>

      {isLoading ? (
        <ShimmerCard className="h-32" />
      ) : (
        <div className="rounded-3xl p-5 bg-gradient-to-br from-accent/20 via-card to-primary/15 border border-white/[0.08]">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</div>
          <div className="text-3xl font-bold font-display text-gradient mt-1">{formatINR(revenueMonth)}</div>
          <div className="text-xs text-muted-foreground mt-1">This month · Today {formatINR(revenueToday)}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {isLoading
          ? [0, 1, 2, 3].map((i) => <ShimmerStat key={i} />)
          : statTiles.map((s) => (
              <div key={s.label} className={`rounded-2xl p-4 bg-gradient-to-br ${s.tint} border border-white/[0.08]`}>
                <s.icon className="w-5 h-5 text-foreground" />
                <div className="text-2xl font-bold font-display mt-3">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground/90 mb-2">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => (
            <TouchPress
              key={a.label}
              onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-card border border-white/[0.06]"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center">
                <a.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[11px] font-medium">{a.label}</span>
            </TouchPress>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground/90">Activity Feed</h2>
          <TouchPress onClick={() => navigate('/activity-logs')} className="text-xs text-primary">See all</TouchPress>
        </div>
        {!activity?.length ? (
          <EmptyState icon={Activity} title="No recent activity" />
        ) : (
          <div className="space-y-2">
            {activity.slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-white/[0.06]">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{a.action || a.event || 'Activity'}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {a.actor_email || a.user_email || ''} · {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mt-1" />
              </div>
            ))}
          </div>
        )}
      </section>
    </MobilePage>
  );
}