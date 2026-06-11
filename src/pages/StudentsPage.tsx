import { supabase } from '@/integrations/supabase/client';
import { adminQuery } from '@/services/api/adminService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { GraduationCap, UserPlus, Copy } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { useRBAC } from '@/hooks/useRBAC';
import { useIsMobileApp } from '@/hooks/useIsMobileApp';
import MobileStudentsPage from './mobile/MobileStudentsPage';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { readActiveOrgFromStorage } from '@/contexts/ActiveOrgContext';

export default function StudentsPage() {
  const __isMobile = useIsMobileApp();
  if (__isMobile) return <MobileStudentsPage />;
  const { role, canAccess } = useRBAC();
  const isTeacher = role === 'teacher';
  const canCreate = canAccess(['superadmin', 'admin', 'support']);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isTeacher ? 'My Students' : 'Students'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isTeacher ? 'Students in your assigned batches' : 'All enrolled students with batch info'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Create Student
          </Button>
        )}
      </div>
      {loading ? <TableSkeleton columns={3} rows={5} /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Login ID</TableHead><TableHead>Batches</TableHead></TableRow></TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground"><GraduationCap className="mx-auto h-8 w-8 mb-2 opacity-50" />No students</TableCell></TableRow>
                ) : students.map(s => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.display_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{s.student_login_id || s.email || '—'}</TableCell>
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
      {canCreate && (
        <CreateStudentDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['students_page'] })}
        />
      )}
    </div>
  );
}

function CreateStudentDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const { isSuperAdmin } = useRBAC();
  const [displayName, setDisplayName] = useState('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');
  const [parentEmail, setParentEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ student_login_id: string; password: string } | null>(null);

  // Default org for non-SA = active/profile org
  useEffect(() => {
    if (open && !organizationId) {
      const active = readActiveOrgFromStorage();
      const fallback = typeof active === 'string' ? active : (profile?.organizationId || '');
      if (fallback) setOrganizationId(fallback);
    }
  }, [open, organizationId, profile]);

  // Org list (SA only) + batches for selected org
  const { data: orgs = [] } = useQuery<any[]>({
    queryKey: ['create_student_orgs', isSuperAdmin],
    enabled: open && isSuperAdmin,
    queryFn: async () => (await adminQuery('list_organizations')) ?? [],
  });
  const { data: batches = [] } = useQuery<any[]>({
    queryKey: ['create_student_batches', organizationId],
    enabled: open && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches').select('id, name').eq('organization_id', organizationId).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = () => {
    setDisplayName(''); setBatchId(''); setParentEmail(''); setResult(null);
  };

  const handleSubmit = async () => {
    if (!displayName.trim() || !organizationId) {
      toast.error('Name and organization are required');
      return;
    }
    setSubmitting(true);
    try {
      // Optional parent lookup
      let parent_user_id: string | undefined;
      if (parentEmail.trim()) {
        const { data: p } = await supabase
          .from('profiles').select('user_id').eq('email', parentEmail.trim().toLowerCase()).maybeSingle();
        if (p?.user_id) parent_user_id = p.user_id;
        else toast.warning('Parent email not found — student will be created without parent link');
      }
      const { data, error } = await supabase.functions.invoke('student-create', {
        body: {
          organization_id: organizationId,
          display_name: displayName.trim(),
          batch_id: batchId || undefined,
          parent_user_id,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({
        student_login_id: (data as any).student_login_id,
        password: (data as any).password,
      });
      onCreated();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create student');
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (v: string) => {
    navigator.clipboard.writeText(v).then(
      () => toast.success('Copied'),
      () => toast.error('Copy failed'),
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create student account</DialogTitle>
          <DialogDescription>
            A unique login ID is generated automatically. The student signs in with this ID
            (no email needed). Password is the same as the ID.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Aarav Kumar" />
            </div>
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={organizationId} onValueChange={setOrganizationId}>
                  <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Batch (optional)</Label>
              <Select value={batchId} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder="No batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parent email (optional)</Label>
              <Input
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="parent@example.com"
              />
              <p className="text-xs text-muted-foreground">Links the student to an existing parent account.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Save these credentials — the password is shown only once.
            </p>
            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Login ID</div>
                  <div className="font-mono font-semibold">{result.student_login_id}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(result.student_login_id)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Password</div>
                  <div className="font-mono font-semibold">{result.password}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(result.password)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Creating…' : 'Create student'}
              </Button>
            </>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
