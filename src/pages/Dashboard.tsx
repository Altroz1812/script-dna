import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { adminQuery } from '@/services/api/adminService';
import { useAuth } from '@/contexts/AuthContext';
import { TiltCard } from '@/components/ui/tilt-card';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { MorphingBlob } from '@/components/ui/morphing-blob';
import { DashboardCardsSkeleton } from '@/components/ui/loading-skeletons';
import {
  Users, BookOpen, Layers, Building2, UserPlus,
  CreditCard, GraduationCap, UserCheck, ArrowRight, Sparkles,
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
  'hsl(265 90% 65%)',   // purple
  'hsl(165 80% 45%)',   // mint
  'hsl(12 90% 65%)',    // coral
  'hsl(265 90% 65%)',
  'hsl(200 80% 55%)',   // sky
  'hsl(330 80% 60%)',   // pink
  'hsl(45 95% 55%)',    // amber
  'hsl(165 80% 45%)',
];

const GRADIENT_PAIRS = [
  'from-purple-500/20 to-purple-900/5',
  'from-emerald-500/20 to-emerald-900/5',
  'from-orange-500/20 to-orange-900/5',
  'from-blue-500/20 to-blue-900/5',
  'from-cyan-500/20 to-cyan-900/5',
  'from-pink-500/20 to-pink-900/5',
  'from-amber-500/20 to-amber-900/5',
  'from-teal-500/20 to-teal-900/5',
];

const ICON_GRADIENTS = [
  'from-purple-400 to-purple-600',
  'from-emerald-400 to-emerald-600',
  'from-orange-400 to-orange-600',
  'from-blue-400 to-blue-600',
  'from-cyan-400 to-cyan-600',
  'from-pink-400 to-pink-600',
  'from-amber-400 to-amber-600',
  'from-teal-400 to-teal-600',
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

  const isSuperadmin = profile?.role === 'superadmin';
  const organizationId = profile?.organizationId ?? null;

  const { data: orgName } = useQuery({
    queryKey: ['org_name', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { organizationService } = await import('@/services/api/organizationService');
      const org = await organizationService.getOrganization(organizationId);
      return org?.name ?? null;
    },
    enabled: !!organizationId,
  });

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['admin_stats', organizationId, isSuperadmin],
    queryFn: () => adminQuery('get_stats', { organizationId, isSuperadmin }) as Promise<Stats>,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    enabled: !!profile,
  });

  const subtitle = isSuperadmin
    ? 'Platform Overview · All Organizations'
    : orgName
      ? `${orgName} Overview`
      : 'Organization Overview';

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

  return (
    <div className="relative min-h-full">
      {/* Background blobs */}
      <MorphingBlob className="w-[500px] h-[500px] -top-32 -right-32 opacity-30" color="hsl(265 90% 65% / 0.08)" />
      <MorphingBlob className="w-[400px] h-[400px] top-1/2 -left-20 opacity-20" color="hsl(12 90% 65% / 0.06)" />
      <MorphingBlob className="w-[300px] h-[300px] bottom-0 right-1/4 opacity-20" color="hsl(165 80% 45% / 0.06)" />

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
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-coral to-accent flex items-center justify-center"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <h1 className="text-3xl font-bold font-display text-gradient">Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-sm pl-[52px]">{subtitle}</p>
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
                    {/* Icon */}
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ICON_GRADIENTS[i % ICON_GRADIENTS.length]} flex items-center justify-center shadow-lg`}>
                        <c.icon className="w-5 h-5 text-white" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </div>

                    {/* Value + Label */}
                    <div>
                      <AnimatedCounter
                        value={c.value}
                        className="text-3xl font-bold font-display text-foreground tracking-tight block"
                      />
                      <span className="text-sm text-muted-foreground mt-0.5 block">{c.label}</span>
                    </div>

                    {/* Decorative bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-[2px]">
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

        {/* Quick Access Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {[
            { title: 'Schedule', desc: 'Manage class timetables', path: '/schedule', gradient: 'from-purple-500/10 to-transparent' },
            { title: 'Attendance', desc: 'Track student presence', path: '/attendance', gradient: 'from-emerald-500/10 to-transparent' },
            { title: 'Live Classes', desc: 'Join or create sessions', path: '/live-classes', gradient: 'from-coral/10 to-transparent' },
          ].map((item) => (
            <TiltCard key={item.title} className="cursor-pointer group" glowColor="hsl(265 90% 65%)">
              <div
                className={`p-5 bg-gradient-to-br ${item.gradient} flex items-center justify-between`}
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
