import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay } from 'date-fns';

/**
 * Fetch classes that are either live now or scheduled for today.
 * Works for all roles (admin/superadmin/support use admin-query, others use RLS).
 */
export function useTodayClasses() {
  const { profile } = useAuth();
  const role = profile?.role;
  const isPrivileged = role === 'superadmin' || role === 'admin' || role === 'support';

  return useQuery({
    queryKey: ['today_live_classes', profile?.id, role],
    queryFn: async () => {
      const dayStart = startOfDay(new Date()).toISOString();
      const dayEnd = endOfDay(new Date()).toISOString();

      if (isPrivileged) {
        const all = (await adminQuery('list_live_classes').catch(() => [])) as any[];
        const filtered = (all || []).filter((c) => {
          if (c.status === 'live') return true;
          const t = c.scheduled_at;
          return t >= dayStart && t <= dayEnd;
        });
        return filtered.map((c: any) => ({
          ...c,
          course_name: c.course_name || c.batches?.courses?.name || '—',
          batch_name: c.batch_name || c.batches?.name || '—',
        }));
      }

      const { data } = await supabase
        .from('live_classes')
        .select(
          'id, title, scheduled_at, status, meeting_url, duration_minutes, batches:batch_id(name, teacher_id, courses:course_id(name))',
        )
        .or(`status.eq.live,and(scheduled_at.gte.${dayStart},scheduled_at.lte.${dayEnd})`)
        .order('scheduled_at', { ascending: true });
      const rows = (data as any[]) || [];
      // Resolve teacher display names by auth uid → profiles.user_id
      const teacherIds = [...new Set(rows.map((r) => r.batches?.teacher_id).filter(Boolean))] as string[];
      const teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', teacherIds);
        (profs || []).forEach((p: any) => {
          teacherMap[p.user_id] = p.display_name || p.email || '—';
        });
      }
      return rows.map((r) => ({
        ...r,
        course_name: r.batches?.courses?.name || '—',
        batch_name: r.batches?.name || '—',
        teacher_name: r.batches?.teacher_id ? teacherMap[r.batches.teacher_id] || '—' : '—',
      }));
    },
    enabled: !!profile,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}