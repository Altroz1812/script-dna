import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminQuery('list_students_with_batches').then(setStudents).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Students</h1>
      <p className="text-muted-foreground text-sm">All enrolled students with batch info</p>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
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
