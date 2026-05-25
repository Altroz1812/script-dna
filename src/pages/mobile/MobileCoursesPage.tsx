import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Wifi, Building2, IndianRupee, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerCard } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';

export default function MobileCoursesPage() {
  const { profile } = useAuth();
  const { role } = useRBAC();
  const { activeOrgId } = useActiveOrg();
  const navigate = useNavigate();
  const isStudent = role === 'student';

  const { data: courses = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['mobile_courses', role, activeOrgId, profile?.id],
    queryFn: async () => {
      if (isStudent) {
        const { data: enrollments } = await supabase
          .from('batch_students')
          .select('batch_id, batches(course_id)')
          .eq('student_id', profile!.id);
        const ids = [...new Set((enrollments || []).map((e: any) => e.batches?.course_id).filter(Boolean))];
        if (ids.length === 0) return [];
        const { data } = await supabase.from('courses').select('*').in('id', ids);
        return data || [];
      }
      return (await adminQuery('list_courses')) as any[];
    },
    enabled: !!profile,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <MobilePage onRefresh={refetch}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">
          {isStudent ? 'My Courses' : 'Courses'}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {isStudent ? 'Programs you are enrolled in' : 'Manage your course catalog'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={isStudent ? 'No enrollments yet' : 'No courses'}
          message={isStudent ? 'Talk to your coordinator to get enrolled.' : 'Create your first course on desktop.'}
        />
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <TouchPress
              key={c.id}
              onClick={() => navigate('/courses')}
              className="w-full rounded-2xl p-4 bg-card border border-white/[0.06] text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  {c.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                    {c.delivery_mode === 'online' ? (
                      <span className="flex items-center gap-1"><Wifi className="w-3 h-3" />Online</span>
                    ) : (
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.center || 'Offline'}</span>
                    )}
                    {c.duration_days != null && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration_days}d</span>
                    )}
                    {c.fee != null && (
                      <span className="flex items-center gap-1"><IndianRupee className="w-3 h-3" />{new Intl.NumberFormat('en-IN').format(c.fee)}</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </TouchPress>
          ))}
        </div>
      )}
    </MobilePage>
  );
}