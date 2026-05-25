import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useRBAC } from '@/hooks/useRBAC';
import { useIsMobileApp } from '@/hooks/useIsMobileApp';
import MobileStudentsPage from './mobile/MobileStudentsPage';

export default function StudentsPage() {
  const __isMobile = useIsMobileApp();
  if (__isMobile) return <MobileStudentsPage />;
  const { role } = useRBAC();
  const isTeacher = role === 'teacher';

  const { data: students = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ['students_page', isTeacher],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      try {
        if (isTeacher) {
          // Teacher: get batches, then students from those batches with profiles
          const { data: batches, error: bErr } = await supabase
            .from('batches')
            .select('id, name');
          if (bErr) throw bErr;

          const batchIds = (batches || []).map(b => b.id);
          if (batchIds.length === 0) return [];

          const { data: batchStudents, error: sErr } = await supabase
            .from('batch_students')
            .select('student_id, batch_id, batches(name)')
            .in('batch_id', batchIds);
          if (sErr) throw sErr;

          // Group by student_id
          const studentMap: Record<string, { student_id: string; batches: string[] }> = {};
          for (const bs of batchStudents || []) {
            if (!studentMap[bs.student_id]) {
              studentMap[bs.student_id] = { student_id: bs.student_id, batches: [] };
            }
            studentMap[bs.student_id].batches.push((bs as any).batches?.name || 'Unknown');
          }

          // Fetch profiles for these students
          const studentIds = Object.keys(studentMap);
          if (studentIds.length === 0) return [];

          const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select('user_id, display_name, email')
            .in('user_id', studentIds);
          if (pErr) throw pErr;

          const profileMap: Record<string, any> = {};
          for (const p of profiles || []) profileMap[p.user_id] = p;

          return Object.values(studentMap).map(s => ({
            user_id: s.student_id,
            display_name: profileMap[s.student_id]?.display_name || null,
            email: profileMap[s.student_id]?.email || null,
            enrollments: s.batches.map(name => ({ batches: { name } })),
          }));
        } else {
          const data = await adminQuery('list_students_with_batches');
          return data ?? [];
        }
      } catch (e: any) {
        toast.error(e.message);
        throw e;
      }
      return [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">
        {isTeacher ? 'My Students' : 'Students'}
      </h1>
      <p className="text-muted-foreground text-sm">
        {isTeacher ? 'Students in your assigned batches' : 'All enrolled students with batch info'}
      </p>
      {loading ? <TableSkeleton columns={3} rows={5} /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Batches</TableHead></TableRow></TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground"><GraduationCap className="mx-auto h-8 w-8 mb-2 opacity-50" />No students</TableCell></TableRow>
                ) : students.map(s => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.display_name || '—'}</TableCell>
                    <TableCell>{s.email || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.enrollments.length === 0 ? <span className="text-muted-foreground text-sm">None</span> :
                          s.enrollments.map((e: any, i: number) => (
                            <Badge key={i} variant="secondary">{e.batches?.name || 'Unknown'}</Badge>
                          ))
                        }
                      </div>
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
