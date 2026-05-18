import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';

export default function AttendancePage() {
  const { activeOrgId } = useActiveOrg();

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminQuery('list_batches')
      .then((b) => setBatches(b || []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [activeOrgId]);

  const loadAttendance = async () => {
    if (!selectedBatch) return;
    setLoading(true);
    try {
      const [studs, att] = await Promise.all([
        adminQuery('list_batch_students', { batch_id: selectedBatch }),
        adminQuery('list_attendance', { batch_id: selectedBatch, date }),
      ]);

      setStudents(studs);
      const rec: Record<string, string> = {};
      for (const s of studs) rec[s.student_id] = 'absent';
      for (const a of att) rec[a.student_id] = a.status;
      setRecords(rec);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { if (selectedBatch) loadAttendance(); }, [selectedBatch, date]);

  const save = async () => {
    setSaving(true);
    try {
      const recs = Object.entries(records).map(([student_id, status]) => ({ student_id, status }));
      await adminQuery('save_attendance', { batch_id: selectedBatch, date, records: recs });
      toast.success('Attendance saved');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
      <div className="flex gap-3">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger className="w-60"><SelectValue placeholder="Select batch" /></SelectTrigger>
          <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        {selectedBatch && <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Attendance'}</Button>}
      </div>
      {!selectedBatch ? <p className="text-muted-foreground">Select a batch to mark attendance</p> : loading ? <TableSkeleton columns={2} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {students.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No students in this batch</TableCell></TableRow> :
                students.map(s => (
                  <TableRow key={s.student_id}>
                    <TableCell className="font-medium">
                      {(s as any).profile?.display_name || (s as any).profile?.email || s.student_id}
                    </TableCell>
                    <TableCell>
                      <Select value={records[s.student_id] || 'present'} onValueChange={v => setRecords(r => ({ ...r, [s.student_id]: v }))}>
                        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
