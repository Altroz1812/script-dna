import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminQuery('list_enrollments').then(setEnrollments).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Enrollments</h1>
      <p className="text-muted-foreground text-sm">All student batch enrollments</p>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Batch</TableHead><TableHead>Course</TableHead><TableHead>Enrolled</TableHead></TableRow></TableHeader>
            <TableBody>
              {enrollments.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground"><GraduationCap className="mx-auto h-8 w-8 mb-2 opacity-50" />No enrollments</TableCell></TableRow> :
                enrollments.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.student_profile?.display_name || e.student_profile?.email || e.student_id}</TableCell>
                    <TableCell>{e.batch?.name || '—'}</TableCell>
                    <TableCell>{e.batch?.courses?.name || '—'}</TableCell>
                    <TableCell>{new Date(e.enrolled_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
