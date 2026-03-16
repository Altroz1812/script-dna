import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { toast } from 'sonner';
import { Users, BookOpen, TrendingUp, Eye } from 'lucide-react';

interface ChildData {
  child_id: string;
  profile: { display_name: string | null; email: string | null; avatar_url: string | null } | null;
  enrollments: { batch_name: string; course_name: string }[];
  avgCompletion: number;
}

export default function ParentChildrenPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadChildren();
  }, [profile]);

  const loadChildren = async () => {
    setLoading(true);
    try {
      // Get linked children
      const { data: links, error: linkErr } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', profile!.id);
      if (linkErr) throw linkErr;
      if (!links || links.length === 0) { setChildren([]); setLoading(false); return; }

      const childIds = links.map(l => l.child_id);

      // Get profiles, enrollments, and progress in parallel
      const [profilesRes, enrollRes, progressRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, email, avatar_url').in('user_id', childIds),
        supabase.from('batch_students').select('student_id, batches(name, courses(name))').in('student_id', childIds),
        supabase.from('student_progress').select('student_id, completion_pct').in('student_id', childIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const enrollMap = new Map<string, { batch_name: string; course_name: string }[]>();
      (enrollRes.data || []).forEach((e: any) => {
        const list = enrollMap.get(e.student_id) || [];
        list.push({ batch_name: e.batches?.name || '', course_name: e.batches?.courses?.name || '' });
        enrollMap.set(e.student_id, list);
      });
      const progressMap = new Map<string, number[]>();
      (progressRes.data || []).forEach((p: any) => {
        const list = progressMap.get(p.student_id) || [];
        list.push(p.completion_pct || 0);
        progressMap.set(p.student_id, list);
      });

      setChildren(childIds.map(id => {
        const progs = progressMap.get(id) || [];
        return {
          child_id: id,
          profile: profileMap.get(id) || null,
          enrollments: enrollMap.get(id) || [],
          avgCompletion: progs.length ? Math.round(progs.reduce((a, b) => a + b, 0) / progs.length) : 0,
        };
      }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Children</h1>
      </div>

      {loading ? <TableSkeleton columns={4} rows={3} /> : children.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No children linked to your account yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Contact the admin to link your child's account.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Enrolled Courses</TableHead>
                  <TableHead>Avg Completion</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {children.map(child => (
                  <TableRow key={child.child_id}>
                    <TableCell className="font-medium">
                      {child.profile?.display_name || child.profile?.email || child.child_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {child.enrollments.length === 0 ? (
                          <span className="text-muted-foreground text-sm">No courses</span>
                        ) : child.enrollments.map((e, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{e.course_name}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${child.avgCompletion}%` }} />
                        </div>
                        <span className="text-sm text-muted-foreground">{child.avgCompletion}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/child-progress?child=${child.child_id}`)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Progress
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
