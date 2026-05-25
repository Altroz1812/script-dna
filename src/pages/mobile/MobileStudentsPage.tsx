import { useEffect, useState } from 'react';
import { GraduationCap, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { useRBAC } from '@/hooks/useRBAC';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerRow } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { Badge } from '@/components/ui/badge';

export default function MobileStudentsPage() {
  const { role } = useRBAC();
  const isTeacher = role === 'teacher';
  const [students, setStudents] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      if (isTeacher) {
        const { data: batches } = await supabase.from('batches').select('id, name');
        const ids = (batches || []).map((b: any) => b.id);
        if (!ids.length) { setStudents([]); return; }
        const { data: bs } = await supabase
          .from('batch_students')
          .select('student_id, batches(name)')
          .in('batch_id', ids);
        const grouped: Record<string, { student_id: string; batches: string[] }> = {};
        for (const r of bs || []) {
          if (!grouped[r.student_id]) grouped[r.student_id] = { student_id: r.student_id, batches: [] };
          grouped[r.student_id].batches.push((r as any).batches?.name || 'Unknown');
        }
        const sids = Object.keys(grouped);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', sids);
        const pm: Record<string, any> = {};
        for (const p of profiles || []) pm[p.user_id] = p;
        setStudents(Object.values(grouped).map((g) => ({
          user_id: g.student_id,
          display_name: pm[g.student_id]?.display_name || null,
          email: pm[g.student_id]?.email || null,
          enrollments: g.batches.map((n) => ({ batches: { name: n } })),
        })));
      } else {
        const data = await adminQuery('list_students_with_batches');
        setStudents(data as any[]);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isTeacher]);

  const filtered = students.filter((s) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return (s.display_name || '').toLowerCase().includes(ql) || (s.email || '').toLowerCase().includes(ql);
  });

  return (
    <MobilePage onRefresh={load}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">
          {isTeacher ? 'My Students' : 'Students'}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {isTeacher ? 'Across your batches' : 'All enrolled students'}
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search students..."
        className="w-full h-11 rounded-xl bg-card border border-white/[0.06] px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
      />

      {loading ? (
        <div className="space-y-2"><ShimmerRow /><ShimmerRow /><ShimmerRow /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No students" message="" />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const initials = (s.display_name || s.email || 'S')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <div key={s.user_id} className="rounded-xl p-3 bg-card border border-white/[0.06] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.display_name || '—'}</div>
                  <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="w-3 h-3" />{s.email || '—'}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(s.enrollments || []).slice(0, 3).map((e: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] h-4 px-1.5">
                        {e.batches?.name || 'Unknown'}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MobilePage>
  );
}