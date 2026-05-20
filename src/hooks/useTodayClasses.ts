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
        return (all || []).filter((c) => {
          if (c.status === 'live') return true;
          const t = c.scheduled_at;
          return t >= dayStart && t <= dayEnd;
        });
      }

      const { data } = await supabase
        .from('live_classes')
        .select('id, title, scheduled_at, status, meeting_url, batches(name)')
        .or(`status.eq.live,and(scheduled_at.gte.${dayStart},scheduled_at.lte.${dayEnd})`)
        .order('scheduled_at', { ascending: true });
      return (data as any[]) || [];
    },
    enabled: !!profile,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}