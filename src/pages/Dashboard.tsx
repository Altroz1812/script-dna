import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { adminQuery } from '@/services/api/adminService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TiltCard } from '@/components/ui/tilt-card';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { MorphingBlob } from '@/components/ui/morphing-blob';
import { DashboardCardsSkeleton } from '@/components/ui/loading-skeletons';
import { EnrollmentTrendsChart } from '@/components/dashboard/EnrollmentTrendsChart';
import {
  Users, BookOpen, Layers, Building2, UserPlus,
  CreditCard, GraduationCap, UserCheck, ArrowRight, Sparkles,
  ClipboardList, Video, FileText, Headphones,
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalCourses: number;
  totalBatches: number;
  totalOrgs: number;
  totalLeads: number;
  totalPayments: number;
  roleCounts: Record<string, number>;
}

const GLOW_COLORS = [
  'hsl(265 90% 65%)',
  'hsl(165 80% 45%)',
  'hsl(12 90% 65%)',
  'hsl(265 90% 65%)',
  'hsl(200 80% 55%)',
  'hsl(330 80% 60%)',
  'hsl(45 95% 55%)',
  'hsl(165 80% 45%)',
];

const GRADIENT_PAIRS = [
  'from-purple-500/40 via-purple-600/20 to-purple-900/10',
  'from-emerald-500/40 via-emerald-600/20 to-emerald-900/10',
  'from-orange-500/40 via-orange-600/20 to-orange-900/10',
  'from-blue-500/40 via-blue-600/20 to-blue-900/10',
  'from-cyan-500/40 via-cyan-600/20 to-cyan-900/10',
  'from-pink-500/40 via-pink-600/20 to-pink-900/10',
  'from-amber-500/40 via-amber-600/20 to-amber-900/10',
  'from-teal-500/40 via-teal-600/20 to-teal-900/10',
];

const ICON_GRADIENTS = [
  'from-purple-300 to-purple-600',
  'from-emerald-300 to-emerald-600',
  'from-orange-300 to-orange-600',
  'from-blue-300 to-blue-600',
  'from-cyan-300 to-cyan-600',
  'from-pink-300 to-pink-600',
  'from-amber-300 to-amber-600',
  'from-teal-300 to-teal-600',
];

const ICON_SHADOWS = [
  'shadow-purple-500/30',
  'shadow-emerald-500/30',
  'shadow-orange-500/30',
  'shadow-blue-500/30',
  'shadow-cyan-500/30',
  'shadow-pink-500/30',
  'shadow-amber-500/30',
  'shadow-teal-500/30',
];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const role = profile?.role;
  const isStudent = role === 'student';
  const isParent = role === 'parent';
  const isTeacher = role === 'teacher';
  const isSupport = role === 'support';
  const isSuperadmin = role === 'superadmin';
  const organizationId = profile?.organizationId ?? null;

  // Student dashboard data
  const { data: studentData, isLoading: studentLoading } = useQuery({
    queryKey: ['student_dashboard', profile?.id],
    queryFn: async () => {
      const [enrollRes, classRes, subRes, progressRes] = await Promise.all([
        supabase.from('batch_students').select('batch_id, batches(name, course_id, courses(name))').eq('student_id', profile!.id),
        supabase.from('live_classes').select('id, title, scheduled_at, status, batches(name)').in('status', ['scheduled', 'live']).order('scheduled_at', { ascending: true }).limit(5),
        supabase.from('student_submissions').select('id, status, score, created_at, practice_assignments(title)').eq('student_id', profile!.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('student_progress').select('completion_pct, status').eq('student_id', profile!.id),
      ]);
      return {
        enrollments: enrollRes.data || [],
        upcomingClasses: classRes.data || [],
        recentSubmissions: subRes.data || [],
        progress: progressRes.data || [],
      };
    },
    enabled: !!profile && isStudent,
    staleTime: 1000 * 60 * 2,
  });

  // Parent dashboard data
  const { data: parentData, isLoading: parentLoading } = useQuery({
    queryKey: ['parent_dashboard', profile?.id],
    queryFn: async () => {
      const { data: links } = await supabase.from('parent_children').select('child_id').eq('parent_id', profile!.id);
      const childIds = (links || []).map(l => l.child_id);
      if (childIds.length === 0) return { children: [], payments: [], upcomingClasses: [] };
      const [profilesRes, progressRes, paymentsRes, classesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, email').in('user_id', childIds),
        supabase.from('student_progress').select('student_id, completion_pct, status, courses(name)').in('student_id', childIds),
        supabase.from('payments').select('*').order('payment_date', { ascending: false }).limit(5),
        supabase.from('live_classes').select('id, title, scheduled_at, status, batches(name)').in('status', ['scheduled', 'live']).order('scheduled_at', { ascending: true }).limit(5),
      ]);
      const childProfiles = (profilesRes.data || []).map(p => {
        const progs = (progressRes.data || []).filter((pr: any) => pr.student_id === p.user_id);
        const avg = progs.length ? Math.round(progs.reduce((s: number, pr: any) => s + (pr.completion_pct || 0), 0) / progs.length) : 0;
        return { id: p.user_id, name: p.display_name || p.email || '', avgCompletion: avg, courseCount: progs.length };
      });
      return { children: childProfiles, payments: paymentsRes.data || [], upcomingClasses: classesRes.data || [] };
    },
    enabled: !!profile && isParent,
    staleTime: 1000 * 60 * 2,
  });

  const { data: orgName } = useQuery({
    queryKey: ['org_name', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { organizationService } = await import('@/services/api/organizationService');
      const org = await organizationService.getOrganization(organizationId);
      return org?.name ?? null;
    },
    enabled: !!organizationId && !isStudent && !isParent,
  });

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['admin_stats', organizationId, isSuperadmin],
    queryFn: () => adminQuery('get_stats', { organizationId, isSuperadmin }) as Promise<Stats>,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    enabled: !!profile && !isStudent && !isParent,
  });

  const cards = useMemo(() => {
    if (!stats) return [];
    const base = [
      { label: isSuperadmin ? 'Total Users' : 'Org Members', value: stats.totalUsers, icon: Users, span: '2x1' as const },
      { label: 'Students', value: stats.roleCounts?.student ?? 0, icon: GraduationCap, span: '1x1' as const },
      { label: 'Teachers', value: stats.roleCounts?.teacher ?? 0, icon: UserCheck, span: '1x1' as const },
      { label: 'Courses', value: stats.totalCourses, icon: BookOpen, span: '1x1' as const },
      { label: 'Batches', value: stats.totalBatches, icon: Layers, span: '1x1' as const },
    ];
    if (isSuperadmin) {
      base.push(
        { label: 'Organizations', value: stats.totalOrgs, icon: Building2, span: '1x1' as const },
        { label: 'Leads', value: stats.totalLeads, icon: UserPlus, span: '1x1' as const },
        { label: 'Payments', value: stats.totalPayments, icon: CreditCard, span: '2x1' as const },
      );
    }
    return base;
  }, [stats, isSuperadmin]);

  // Student dashboard
  if (isStudent) {
    const avgCompletion = studentData?.progress?.length
      ? Math.round(studentData.progress.reduce((s: number, p: any) => s + (p.completion_pct || 0), 0) / studentData.progress.length)
      : 0;

    return (
      <div className="relative min-h-full">
        <MorphingBlob className="w-[500px] h-[500px] -top-32 -right-32 opacity-40" color="hsl(265 90% 65% / 0.12)" />
        <div className="relative z-10 space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <motion.div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary via-coral to-accent flex items-center justify-center shadow-lg shadow-primary/30"
                  animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                  <Sparkles className="w-5 h-5 text-white" />
                </motion.div>
                <h1 className="text-3xl font-bold font-display text-gradient">Welcome back!</h1>
              </div>
              <p className="text-muted-foreground text-sm pl-[56px]">Your learning dashboard</p>
            </div>
          </motion.div>

          {studentLoading ? <DashboardCardsSkeleton count={4} /> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Courses', value: studentData?.enrollments?.length || 0, icon: BookOpen, color: 'from-purple-300 to-purple-600' },
                  { label: 'Submissions', value: studentData?.recentSubmissions?.length || 0, icon: GraduationCap, color: 'from-emerald-300 to-emerald-600' },
                  { label: 'Completion', value: `${avgCompletion}%`, icon: UserCheck, color: 'from-orange-300 to-orange-600' },
                  { label: 'Upcoming Classes', value: studentData?.upcomingClasses?.length || 0, icon: Layers, color: 'from-blue-300 to-blue-600' },
                ].map((c, i) => (
                  <TiltCard key={c.label} glowColor={GLOW_COLORS[i]} className="h-[140px]">
                    <div className={`h-full p-5 bg-gradient-to-br ${GRADIENT_PAIRS[i]} flex flex-col justify-between`}>
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg`}>
                        <c.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="text-3xl font-bold font-display text-gradient tracking-tight block">{c.value}</span>
                        <span className="text-sm text-muted-foreground">{c.label}</span>
                      </div>
                    </div>
                  </TiltCard>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'My Courses', desc: 'View enrolled courses & lessons', path: '/courses', gradient: 'from-purple-500/30 via-purple-600/10 to-transparent', borderColor: 'border-l-purple-500' },
                  { title: 'Practice', desc: 'Download assignments & submit work', path: '/practice', gradient: 'from-emerald-500/30 via-emerald-600/10 to-transparent', borderColor: 'border-l-emerald-500' },
                  { title: 'My Progress', desc: 'Track scores & improvement', path: '/my-progress', gradient: 'from-orange-500/30 via-orange-600/10 to-transparent', borderColor: 'border-l-orange-500' },
                ].map(item => (
                  <TiltCard key={item.title} className="cursor-pointer group" glowColor="hsl(265 90% 65%)">
                    <div className={`p-5 bg-gradient-to-br ${item.gradient} flex items-center justify-between border-l-[3px] ${item.borderColor}`}
                      onClick={() => navigate(item.path)}>
                      <div>
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </TiltCard>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Parent dashboard
  if (isParent) {
    return (
      <div className="relative min-h-full">
        <MorphingBlob className="w-[500px] h-[500px] -top-32 -right-32 opacity-40" color="hsl(265 90% 65% / 0.12)" />
        <div className="relative z-10 space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <motion.div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary via-coral to-accent flex items-center justify-center shadow-lg shadow-primary/30"
                  animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                  <Sparkles className="w-5 h-5 text-white" />
                </motion.div>
                <h1 className="text-3xl font-bold font-display text-gradient">Parent Dashboard</h1>
              </div>
              <p className="text-muted-foreground text-sm pl-[56px]">Monitor your children's learning</p>
            </div>
          </motion.div>

          {parentLoading ? <DashboardCardsSkeleton count={4} /> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Children', value: parentData?.children?.length || 0, icon: Users, color: 'from-purple-300 to-purple-600' },
                  { label: 'Upcoming Classes', value: parentData?.upcomingClasses?.length || 0, icon: Layers, color: 'from-emerald-300 to-emerald-600' },
                  { label: 'Recent Payments', value: parentData?.payments?.length || 0, icon: CreditCard, color: 'from-orange-300 to-orange-600' },
                ].map((c, i) => (
                  <TiltCard key={c.label} glowColor={GLOW_COLORS[i]} className="h-[140px]">
                    <div className={`h-full p-5 bg-gradient-to-br ${GRADIENT_PAIRS[i]} flex flex-col justify-between`}>
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg`}>
                        <c.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="text-3xl font-bold font-display text-gradient tracking-tight block">{c.value}</span>
                        <span className="text-sm text-muted-foreground">{c.label}</span>
                      </div>
                    </div>
                  </TiltCard>
                ))}
              </div>

              {/* Children progress summary */}
              {parentData?.children && parentData.children.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parentData.children.map((child: any, i: number) => (
                    <TiltCard key={child.id} className="cursor-pointer group" glowColor={GLOW_COLORS[i % GLOW_COLORS.length]}>
                      <div className={`p-5 bg-gradient-to-br ${GRADIENT_PAIRS[i % GRADIENT_PAIRS.length]} flex items-center justify-between`}
                        onClick={() => navigate(`/child-progress?child=${child.id}`)}>
                        <div>
                          <h3 className="font-semibold text-foreground">{child.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{child.courseCount} course(s) · {child.avgCompletion}% avg completion</p>
                          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden mt-2">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${child.avgCompletion}%` }} />
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </TiltCard>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: 'My Children', desc: 'View linked children', path: '/my-children', gradient: 'from-purple-500/30 via-purple-600/10 to-transparent', borderColor: 'border-l-purple-500' },
                  { title: 'Payments', desc: 'View & make payments', path: '/payments', gradient: 'from-emerald-500/30 via-emerald-600/10 to-transparent', borderColor: 'border-l-emerald-500' },
                  { title: 'Attendance', desc: "Track children's attendance", path: '/attendance', gradient: 'from-orange-500/30 via-orange-600/10 to-transparent', borderColor: 'border-l-orange-500' },
                ].map(item => (
                  <TiltCard key={item.title} className="cursor-pointer group" glowColor="hsl(265 90% 65%)">
                    <div className={`p-5 bg-gradient-to-br ${item.gradient} flex items-center justify-between border-l-[3px] ${item.borderColor}`}
                      onClick={() => navigate(item.path)}>
                      <div>
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </TiltCard>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Admin/Teacher dashboard
  const subtitle = isSuperadmin
    ? 'Platform Overview · All Organizations'
    : orgName
      ? `${orgName} Overview`
      : 'Organization Overview';

  return (
    <div className="relative min-h-full">
      {/* Background blobs */}
      <MorphingBlob className="w-[500px] h-[500px] -top-32 -right-32 opacity-40" color="hsl(265 90% 65% / 0.12)" />
      <MorphingBlob className="w-[400px] h-[400px] top-1/2 -left-20 opacity-30" color="hsl(12 90% 65% / 0.1)" />
      <MorphingBlob className="w-[300px] h-[300px] bottom-0 right-1/4 opacity-25" color="hsl(165 80% 45% / 0.1)" />

      <div className="relative z-10 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex items-end justify-between"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <motion.div
                className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary via-coral to-accent flex items-center justify-center shadow-lg shadow-primary/30"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <h1 className="text-3xl font-bold font-display text-gradient">Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-sm pl-[56px]">{subtitle}</p>
          </div>
          <div className="flex gap-3">
            <MagneticButton onClick={() => navigate('/courses')} className="text-xs">
              <BookOpen className="w-3.5 h-3.5" /> New Course
            </MagneticButton>
            <MagneticButton onClick={() => navigate('/leads')} className="text-xs">
              <UserPlus className="w-3.5 h-3.5" /> New Lead
            </MagneticButton>
            {isSuperadmin && (
              <MagneticButton onClick={() => navigate('/users')} className="text-xs">
                <Users className="w-3.5 h-3.5" /> Add User
              </MagneticButton>
            )}
          </div>
        </motion.div>

        {/* Bento Grid */}
        {isLoading ? (
          <DashboardCardsSkeleton count={isSuperadmin ? 8 : 5} />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[140px]"
          >
            {cards.map((c, i) => (
              <motion.div key={c.label} variants={itemVariants}>
                <TiltCard
                  span={c.span}
                  glowColor={GLOW_COLORS[i % GLOW_COLORS.length]}
                  className="h-full"
                >
                  <div className={`relative h-full p-5 bg-gradient-to-br ${GRADIENT_PAIRS[i % GRADIENT_PAIRS.length]} flex flex-col justify-between`}>
                    <div className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none"
                      style={{ boxShadow: `inset 0 0 40px ${GLOW_COLORS[i % GLOW_COLORS.length].replace(')', ' / 0.15)')}` }}
                    />
                    <div className="flex items-center justify-between relative z-10">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${ICON_GRADIENTS[i % ICON_GRADIENTS.length]} flex items-center justify-center shadow-lg ${ICON_SHADOWS[i % ICON_SHADOWS.length]}`}>
                        <c.icon className="w-5 h-5 text-white" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="relative z-10">
                      <AnimatedCounter
                        value={c.value}
                        className="text-3xl font-bold font-display text-gradient tracking-tight block"
                      />
                      <span className="text-sm text-muted-foreground mt-0.5 block">{c.label}</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[3px]">
                      <motion.div
                        className={`h-full bg-gradient-to-r ${ICON_GRADIENTS[i % ICON_GRADIENTS.length]}`}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.08, ease: [0.23, 1, 0.32, 1] }}
                        style={{ transformOrigin: 'left' }}
                      />
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!isLoading && <EnrollmentTrendsChart />}

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {[
            { title: 'Schedule', desc: 'Manage class timetables', path: '/schedule', gradient: 'from-purple-500/30 via-purple-600/10 to-transparent', borderColor: 'border-l-purple-500' },
            { title: 'Attendance', desc: 'Track student presence', path: '/attendance', gradient: 'from-emerald-500/30 via-emerald-600/10 to-transparent', borderColor: 'border-l-emerald-500' },
            { title: 'Live Classes', desc: 'Join or create sessions', path: '/live-classes', gradient: 'from-orange-500/30 via-orange-600/10 to-transparent', borderColor: 'border-l-orange-500' },
          ].map((item) => (
            <TiltCard key={item.title} className="cursor-pointer group" glowColor="hsl(265 90% 65%)">
              <div
                className={`p-5 bg-gradient-to-br ${item.gradient} flex items-center justify-between border-l-[3px] ${item.borderColor}`}
                onClick={() => navigate(item.path)}
              >
                <div>
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </TiltCard>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
