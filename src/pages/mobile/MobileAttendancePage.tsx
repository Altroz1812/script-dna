import { useEffect, useState } from 'react';
import { Check, X, Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { adminQuery } from '@/services/api/adminService';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerRow } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const STATUSES: { value: string; label: string; icon: any; cls: string }[] = [
  { value: 'present', label: 'P', icon: Check, cls: 'bg-success/20 text-success border-success/30' },
  { value: 'late', label: 'L', icon: Clock, cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'absent', label: 'A', icon: X, cls: 'bg-destructive/20 text-destructive border-destructive/30' },
];

export default function MobileAttendancePage() {
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
      .then((b) => setBatches((b as any[]) || []))
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [activeOrgId]);

  const loadRoster = async () => {
    if (!selectedBatch) return;
    setLoading(true);
    try {
      const [studs, att]: any = await Promise.all([
        adminQuery('list_batch_students', { batch_id: selectedBatch }),
        adminQuery('list_attendance', { batch_id: selectedBatch, date }),
      ]);
      setStudents(studs || []);
      const r: Record<string, string> = {};
      for (const s of studs || []) r[s.student_id] = 'absent';
      for (const a of att || []) r[a.student_id] = a.status;
      setRecords(r);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedBatch) loadRoster(); }, [selectedBatch, date]);

  const save = async () => {
    setSaving(true);
    try {
      const recs = Object.entries(records).map(([student_id, status]) => ({ student_id, status }));
      await adminQuery('save_attendance', { batch_id: selectedBatch, date, records: recs });
      toast.success('Attendance saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setAll = (status: string) => {
    const r: Record<string, string> = {};
    for (const s of students) r[s.student_id] = status;
    setRecords(r);
  };

  return (
    <MobilePage onRefresh={loadRoster}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">Attendance</h1>
        <p className="text-xs text-muted-foreground mt-1">Mark student attendance for a date</p>
      </div>

      <div className="space-y-2">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger className="h-12"><SelectValue placeholder="Select batch" /></SelectTrigger>
          <SelectContent>
            {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-12 rounded-xl bg-card border border-white/[0.06] px-4 text-sm"
        />
      </div>

      {!selectedBatch ? (
        <EmptyState icon={Check} title="Pick a batch" message="Choose a batch and date to start." />
      ) : loading ? (
        <div className="space-y-2"><ShimmerRow /><ShimmerRow /></div>
      ) : students.length === 0 ? (
        <EmptyState icon={Check} title="No students" message="This batch has no enrolled students." />
      ) : (
        <>
          <div className="flex gap-2 text-xs">
            <TouchPress onClick={() => setAll('present')} className="flex-1 h-9 rounded-lg bg-success/15 text-success font-medium">All Present</TouchPress>
            <TouchPress onClick={() => setAll('absent')} className="flex-1 h-9 rounded-lg bg-destructive/15 text-destructive font-medium">All Absent</TouchPress>
          </div>

          <div className="space-y-2">
            {students.map((s: any) => {
              const cur = records[s.student_id] || 'absent';
              const name = s.profile?.display_name || s.profile?.email || s.student_id;
              return (
                <div key={s.student_id} className="rounded-xl p-3 bg-card border border-white/[0.06] flex items-center gap-3">
                  <div className="flex-1 min-w-0 text-sm font-medium truncate">{name}</div>
                  <div className="flex gap-1.5 shrink-0">
                    {STATUSES.map((st) => {
                      const active = cur === st.value;
                      return (
                        <TouchPress
                          key={st.value}
                          onClick={() => setRecords((r) => ({ ...r, [s.student_id]: st.value }))}
                          className={cn(
                            'h-9 w-9 rounded-lg border flex items-center justify-center text-sm font-bold transition-colors',
                            active ? st.cls : 'border-white/[0.06] text-muted-foreground',
                          )}
                          aria-label={st.value}
                        >
                          {st.label}
                        </TouchPress>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <TouchPress
            onClick={save}
            className="sticky bottom-4 w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Attendance'}
          </TouchPress>
        </>
      )}
    </MobilePage>
  );
}