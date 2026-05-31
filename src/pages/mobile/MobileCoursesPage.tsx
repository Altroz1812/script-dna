import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Wifi, Building2, IndianRupee, ArrowRight, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { courseService, type CreateCourseParams } from '@/services/api/courseService';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerCard } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { FAB } from '@/components/mobile/ui/FAB';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CourseForm } from '@/components/courses/CourseForm';
import { toast } from 'sonner';

export default function MobileCoursesPage() {
  const { profile } = useAuth();
  const { role } = useRBAC();
  const { activeOrgId } = useActiveOrg();
  const navigate = useNavigate();
  const isStudent = role === 'student';
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = role === 'admin' || role === 'superadmin';

  const createMutation = useMutation({
    mutationFn: (values: Partial<CreateCourseParams>) => courseService.createCourse({
      name: values.name!.trim(),
      description: values.description?.trim() || null,
      created_by: profile!.id,
      grade_level: values.grade_level?.trim() || undefined,
      duration_days: values.duration_days ?? undefined,
      total_hours: values.total_hours ?? undefined,
      daily_hours: values.daily_hours ?? undefined,
      language: values.language || undefined,
      writing_style: values.writing_style || undefined,
      includes_speed: values.includes_speed ?? false,
      fee: values.fee ?? 0,
      delivery_mode: values.delivery_mode || 'online',
      center: values.center?.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Course created');
      queryClient.invalidateQueries({ queryKey: ['mobile_courses'] });
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create course'),
  });

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

      {canCreate && (
        <>
          <FAB icon={Plus} label="Add course" onClick={() => setCreateOpen(true)} />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Course</DialogTitle>
              </DialogHeader>
              <CourseForm
                onSubmit={(v) => createMutation.mutate(v)}
                isPending={createMutation.isPending}
                submitLabel="Create Course"
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </MobilePage>
  );
}