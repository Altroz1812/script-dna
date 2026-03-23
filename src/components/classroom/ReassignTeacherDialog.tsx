import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserRoundCog } from 'lucide-react';

interface Teacher {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

interface ReassignTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchName: string;
  currentTeacherId: string | null;
  currentTeacherName: string | null;
  onReassigned: () => void;
}

export function ReassignTeacherDialog({
  open, onOpenChange, batchId, batchName,
  currentTeacherId, currentTeacherName, onReassigned,
}: ReassignTeacherDialogProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedTeacherId('');
    setLoading(true);
    adminQuery('list_teachers')
      .then((data) => setTeachers(data ?? []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  const handleReassign = async () => {
    if (!selectedTeacherId) return;
    setSaving(true);
    try {
      await adminQuery('update_batch', { id: batchId, teacher_id: selectedTeacherId });
      const newTeacher = teachers.find(t => t.user_id === selectedTeacherId);
      // Send notification to the new teacher
      await adminQuery('create_notification', {
        user_id: selectedTeacherId,
        title: 'Class Reassigned',
        message: `You have been assigned to batch "${batchName}". Please check your live classes.`,
      });
      toast.success(`Teacher reassigned to ${newTeacher?.display_name || newTeacher?.email}`);
      onReassigned();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const availableTeachers = teachers.filter(t => t.user_id !== currentTeacherId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5 text-primary" />
            Reassign Teacher
          </DialogTitle>
          <DialogDescription>
            Select a new teacher for batch "{batchName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {currentTeacherName && (
            <div className="text-sm">
              <span className="text-muted-foreground">Current teacher:</span>{' '}
              <span className="font-medium text-foreground">{currentTeacherName}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New Teacher</label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Loading teachers...' : 'Select a teacher'} />
              </SelectTrigger>
              <SelectContent>
                {availableTeachers.map((t) => (
                  <SelectItem key={t.user_id} value={t.user_id}>
                    {t.display_name || t.email || t.user_id}
                  </SelectItem>
                ))}
                {availableTeachers.length === 0 && !loading && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">No other teachers available</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReassign} disabled={!selectedTeacherId || saving}>
            {saving ? 'Reassigning...' : 'Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
