import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, BookOpen, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerRow } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';

interface ChildData {
  id: string;
  name: string;
  initials: string;
  enrollments: { batch: string; course: string }[];
  avg: number;
}

export default function MobileParentChildrenPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: links } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', profile.id);
      const ids = (links || []).map((l) => l.child_id);
      if (!ids.length) { setChildren([]); return; }
      const [pRes, eRes, gRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, email, avatar_url').in('user_id', ids),
        supabase.from('batch_students').select('student_id, batches(name, courses(name))').in('student_id', ids),
        supabase.from('student_progress').select('student_id, completion_pct').in('student_id', ids),
      ]);
      const pm = new Map((pRes.data || []).map((p: any) => [p.user_id, p]));
      const em = new Map<string, { batch: string; course: string }[]>();
      (eRes.data || []).forEach((e: any) => {
        const list = em.get(e.student_id) || [];
        list.push({ batch: e.batches?.name || '', course: e.batches?.courses?.name || '' });
        em.set(e.student_id, list);
      });
      const gm = new Map<string, number[]>();
      (gRes.data || []).forEach((p: any) => {
        const list = gm.get(p.student_id) || [];
        list.push(p.completion_pct || 0);
        gm.set(p.student_id, list);
      });
      setChildren(ids.map((id) => {
        const p: any = pm.get(id);
        const name = p?.display_name || p?.email || 'Child';
        const progs = gm.get(id) || [];
        return {
          id,
          name,
          initials: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
          enrollments: em.get(id) || [],
          avg: progs.length ? Math.round(progs.reduce((a, b) => a + b, 0) / progs.length) : 0,
        };
      }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [profile?.id]);

  return (
    <MobilePage onRefresh={load}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">My Children</h1>
        <p className="text-xs text-muted-foreground mt-1">Tap a child to view full progress</p>
      </div>

      {loading ? (
        <div className="space-y-2"><ShimmerRow /><ShimmerRow /><ShimmerRow /></div>
      ) : children.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No children linked"
          message="Contact your school admin to link your child's account."
        />
      ) : (
        <div className="space-y-3">
          {children.map((c) => (
            <TouchPress
              key={c.id}
              onClick={() => navigate(`/child-progress?child=${c.id}`)}
              className="w-full rounded-2xl p-4 bg-card border border-white/[0.06] text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-sm font-semibold">
                  {c.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {c.enrollments.length} {c.enrollments.length === 1 ? 'course' : 'courses'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gradient leading-none">{c.avg}%</div>
                  <div className="text-[10px] text-muted-foreground mt-1">complete</div>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                  style={{ width: `${c.avg}%` }}
                />
              </div>
              {c.enrollments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.enrollments.slice(0, 3).map((e, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 truncate max-w-[140px]">
                      {e.course || e.batch}
                    </span>
                  ))}
                  {c.enrollments.length > 3 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground">
                      +{c.enrollments.length - 3}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-3 flex items-center justify-end gap-1 text-[11px] text-primary">
                <Eye className="w-3 h-3" /> View progress
              </div>
            </TouchPress>
          ))}
        </div>
      )}
    </MobilePage>
  );
}