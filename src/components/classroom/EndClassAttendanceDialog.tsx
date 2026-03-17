import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { batchService } from '@/services/api/courseService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserCheck, UserX, Clock } from 'lucide-react';

type Student = {
  student_id: string;
  profiles?: { display_name: string | null; email: string | null } | null;
};

interface EndClassAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveClass: { id: string; batch_id: string; schedule_id: string | null; title: string } | null;
  isTeacher: boolean;
  isAdmin: boolean;
  onClassEnded: () => void;
}

const STATUS_ICONS = {
  present: <UserCheck className="h-4 w-4 text-green-400" />,
  absent: <UserX className="h-4 w-4 text-destructive" />,
  late: <Clock className="h-4 w-4 text-yellow-400" />,
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  present: 'bg-green-500/20 text-green-400 border-green-500/30',
  absent: 'bg-destructive/20 text-destructive border-destructive/30',
  late: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export function EndClassAttendanceDialog({
  open, onOpenChange, liveClass, isTeacher, isAdmin, onClassEnded
}: EndClassAttendanceDialogProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !liveClass) return;
    loadStudents();
  }, [open, liveClass]);

  const loadStudents = async () => {
    if (!liveClass) return;
    setLoading(true);
    try {
      let studs: Student[];
      if (isTeacher) {
        const { data, error } = await supabase
          .from('batch_students')
          .select('student_id, profiles:student_id(display_name, email)')
          .eq('batch_id', liveClass.batch_id);
        if (error) throw error;
        studs = (data as any[]) || [];
      } else {
        studs = await batchService.getStudents(liveClass.batch_id);
      }
      setStudents(studs);
      // Default all to present
      const rec: Record<string, string> = {};
      studs.forEach(s => { rec[s.student_id] = 'present'; });
      setRecords(rec);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndAndSave = async () => {
    if (!liveClass) return;
    setSaving(true);
    try {
      // 1. Save attendance first (manual overrides)
      const today = new Date().toISOString().slice(0, 10);
      if (isTeacher) {
        // Delete existing for today and re-insert
        await supabase.from('attendance').delete()
          .eq('batch_id', liveClass.batch_id).eq('date', today);
        const rows = Object.entries(records).map(([student_id, status]) => ({
          batch_id: liveClass.batch_id,
          student_id,
          date: today,
          status: status as any,
          schedule_id: liveClass.schedule_id,
        }));
        if (rows.length > 0) {
          const { error } = await supabase.from('attendance').insert(rows);
          if (error) throw error;
        }
        // 2. End the class
        const { error: endError } = await supabase.from('live_classes')
          .update({ status: 'completed' as any })
          .eq('id', liveClass.id);
        if (endError) throw endError;
      } else {
        // Admin flow: save via admin-query
        const recs = Object.entries(records).map(([student_id, status]) => ({ student_id, status }));
        await adminQuery('save_attendance', {
          batch_id: liveClass.batch_id,
          date: today,
          records: recs,
        });
        await adminQuery('update_live_class', { id: liveClass.id, status: 'completed' });
      }
      toast.success('Class ended & attendance saved');
      onOpenChange(false);
      onClassEnded();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(records).filter(s => s === 'present').length;
  const absentCount = Object.values(records).filter(s => s === 'absent').length;
  const lateCount = Object.values(records).filter(s => s === 'late').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>End Class & Mark Attendance</DialogTitle>
          <p className="text-sm text-muted-foreground">{liveClass?.title}</p>
        </DialogHeader>

        {/* Summary */}
        <div className="flex gap-3 text-sm">
          <Badge variant="outline" className={STATUS_BADGE_COLORS.present}>
            {STATUS_ICONS.present} <span className="ml-1">{presentCount} Present</span>
          </Badge>
          <Badge variant="outline" className={STATUS_BADGE_COLORS.absent}>
            {STATUS_ICONS.absent} <span className="ml-1">{absentCount} Absent</span>
          </Badge>
          <Badge variant="outline" className={STATUS_BADGE_COLORS.late}>
            {STATUS_ICONS.late} <span className="ml-1">{lateCount} Late</span>
          </Badge>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No students in this batch</div>
          ) : (
            students.map(s => (
              <div key={s.student_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  {STATUS_ICONS[records[s.student_id] as keyof typeof STATUS_ICONS] || STATUS_ICONS.present}
                  <span className="font-medium text-sm text-foreground">
                    {(s as any).profiles?.display_name || s.student_id.slice(0, 8)}
                  </span>
                </div>
                <Select
                  value={records[s.student_id] || 'present'}
                  onValueChange={v => setRecords(r => ({ ...r, [s.student_id]: v }))}
                >
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleEndAndSave} disabled={saving}>
            {saving ? 'Saving...' : 'End Class & Save Attendance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
