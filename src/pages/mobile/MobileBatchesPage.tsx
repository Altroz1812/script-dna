import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Users, BookOpen, Plus } from 'lucide-react';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { batchService, courseService, type Batch, type Course } from '@/services/api/courseService';
import { adminQuery } from '@/services/api/adminService';
import { useRBAC } from '@/hooks/useRBAC';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { ShimmerCard } from '@/components/mobile/ui/Shimmer';
import { EmptyState } from '@/components/mobile/ui/EmptyState';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { FAB } from '@/components/mobile/ui/FAB';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function MobileBatchesPage() {
  const { activeOrgId } = useActiveOrg();
  const navigate = useNavigate();
  const { role } = useRBAC();
  const canCreate = role === 'admin' || role === 'superadmin' || role === 'teacher';
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [maxStudents, setMaxStudents] = useState(25);

  const { data: batches = [], isLoading, refetch } = useQuery<Batch[]>({
    queryKey: ['mobile_batches', activeOrgId],
    queryFn: () => batchService.listBatches(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['mobile_courses_for_batch', activeOrgId],
    queryFn: async () => (await adminQuery('list_courses')) as Course[],
    enabled: canCreate && open,
  });

  const createMutation = useMutation({
    mutationFn: () => batchService.createBatch(activeOrgId!, courseId, name.trim(), maxStudents),
    onSuccess: () => {
      toast.success('Batch created');
      queryClient.invalidateQueries({ queryKey: ['mobile_batches'] });
      setOpen(false);
      setName(''); setCourseId(''); setMaxStudents(25);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create batch'),
  });

  return (
    <MobilePage onRefresh={refetch}>
      <div>
        <h1 className="text-2xl font-bold font-display text-gradient">Batches</h1>
        <p className="text-xs text-muted-foreground mt-1">Your assigned student groups</p>
      </div>

      {isLoading ? (
        <div className="space-y-3"><ShimmerCard /><ShimmerCard /></div>
      ) : batches.length === 0 ? (
        <EmptyState icon={Layers} title="No batches" message="Create or assign batches on desktop." />
      ) : (
        <div className="space-y-3">
          {batches.map((b: any) => (
            <TouchPress
              key={b.id}
              onClick={() => navigate(`/batches/${b.id}`)}
              className="w-full rounded-2xl p-4 bg-card border border-white/[0.06] text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{b.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    {b.course_name && (
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{b.course_name}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {b.student_count ?? 0}/{b.max_students ?? '—'} students
                  </div>
                </div>
              </div>
            </TouchPress>
          ))}
        </div>
      )}

      {canCreate && (
        <>
          <FAB icon={Plus} label="Add batch" onClick={() => setOpen(true)} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New Batch</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Course</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Batch Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning Batch A" />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Students</Label>
                  <Input type="number" min={1} value={maxStudents} onChange={(e) => setMaxStudents(parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  disabled={!courseId || !name.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Batch'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </MobilePage>
  );
}