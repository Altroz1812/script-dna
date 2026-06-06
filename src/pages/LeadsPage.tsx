import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, CheckCircle2 } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: '', notes: '' });
  const [detailLead, setDetailLead] = useState<any | null>(null);
  const [assignOrgId, setAssignOrgId] = useState<string>('');

  const { data: leads = [], isLoading } = useQuery<any[]>({
    queryKey: ['leads'],
    queryFn: () => adminQuery('list_leads'),
    staleTime: 1000 * 60 * 5,
  });

  const { data: organizations = [] } = useQuery<any[]>({
    queryKey: ['organizations'],
    queryFn: () => adminQuery('list_organizations'),
    staleTime: 1000 * 60 * 10,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['admin_stats'] });
  };

  const createMutation = useMutation({
    mutationFn: () => adminQuery('create_lead', {
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      source: form.source || null,
      notes: form.notes || null,
    }),
    onSuccess: () => {
      toast.success('Lead created');
      setOpen(false);
      setForm({ name: '', email: '', phone: '', source: '', notes: '' });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminQuery('update_lead', { id, status }),
    onSuccess: () => { toast.success('Status updated'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminQuery('delete_lead', { id }),
    onSuccess: () => { toast.success('Deleted'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, organization_id }: { id: string; organization_id?: string }) =>
      adminQuery('approve_lead', { id, organization_id }),
    onSuccess: (data: any) => {
      const errs = Array.isArray(data?.errors) ? data.errors : [];
      toast.success(`Created ${data?.created_count ?? 0} student(s), enrolled ${data?.enrolled_count ?? 0}`);
      if (errs.length) toast.warning(`${errs.length} issue(s): ${errs.slice(0, 2).join('; ')}`);
      setDetailLead(null);
      setAssignOrgId('');
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    createMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Leads</h1><p className="text-muted-foreground text-sm">CRM lead tracking</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Lead</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Source</Label><Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. Website, Referral" /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Creating...' : 'Create Lead'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <TableSkeleton columns={6} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Source</TableHead><TableHead>Students</TableHead><TableHead>Courses / Batches</TableHead><TableHead>Status</TableHead><TableHead className="w-32 text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {leads.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No leads yet</TableCell></TableRow> :
                leads.map(l => {
                  const meta = l.metadata ?? {};
                  const students = Array.isArray(meta.students) ? meta.students : [];
                  const itemsM = Array.isArray(meta.items) ? meta.items : [];
                  const isCheckout = l.source === 'checkout' || students.length > 0;
                  return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.name}
                      {isCheckout && <Badge variant="secondary" className="ml-2">Checkout</Badge>}
                    </TableCell>
                    <TableCell>{l.email || '—'}</TableCell>
                    <TableCell>{l.source || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {students.length > 0
                        ? students.map((s: any) => `${s.name} (${s.grade || '—'})`).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {itemsM.length > 0
                        ? itemsM.map((i: any) => `${i.course_name}${i.batch_name ? ` · ${i.batch_name}` : ''}`).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Select value={l.status} onValueChange={v => updateStatusMutation.mutate({ id: l.id, status: v })}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isCheckout && (
                          <Button variant="ghost" size="icon" title="View details" onClick={() => setDetailLead(l)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {isCheckout && l.status !== 'converted' && (
                          <Button
                            variant="ghost" size="icon"
                            title={l.organization_id ? 'Approve & create students' : 'Open to assign organization first'}
                            onClick={() => { setAssignOrgId(l.organization_id || ''); setDetailLead(l); }}
                          >
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(l.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      <Dialog open={!!detailLead} onOpenChange={(o) => { if (!o) { setDetailLead(null); setAssignOrgId(''); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Checkout Lead Details</DialogTitle></DialogHeader>
          {detailLead && (() => {
            const meta = detailLead.metadata ?? {};
            const students = Array.isArray(meta.students) ? meta.students : [];
            const itemsM = Array.isArray(meta.items) ? meta.items : [];
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-muted-foreground">Parent</Label><div>{meta.parent_name || detailLead.name}</div></div>
                  <div><Label className="text-muted-foreground">Email</Label><div>{meta.parent_email || detailLead.email || '—'}</div></div>
                  <div><Label className="text-muted-foreground">Payment</Label><div className="capitalize">{meta.payment_method || '—'}</div></div>
                  <div><Label className="text-muted-foreground">Final Amount</Label><div>₹{meta.final_amount ?? '—'}</div></div>
                </div>
                {detailLead.status !== 'converted' && (
                  <div>
                    <Label className="text-muted-foreground">Organization {detailLead.organization_id ? '' : '(not assigned)'}</Label>
                    <Select value={assignOrgId} onValueChange={setAssignOrgId}>
                      <SelectTrigger><SelectValue placeholder="Select organization to assign" /></SelectTrigger>
                      <SelectContent>
                        {organizations.map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Courses & Batches</Label>
                  <ul className="list-disc pl-5 mt-1">
                    {itemsM.map((i: any, idx: number) => (
                      <li key={idx}>{i.course_name} {i.batch_name && <span className="text-muted-foreground">· {i.batch_name}</span>} <span className="text-muted-foreground">(₹{i.fee})</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Label className="text-muted-foreground">Students</Label>
                  <ul className="list-disc pl-5 mt-1">
                    {students.map((s: any, idx: number) => (
                      <li key={idx}>{s.name} — Grade {s.grade || '—'} · {s.course_name}{s.batch_name ? ` · ${s.batch_name}` : ''}</li>
                    ))}
                  </ul>
                </div>
                {Array.isArray(meta.created_students) && meta.created_students.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Created Accounts</Label>
                    <ul className="list-disc pl-5 mt-1">
                      {meta.created_students.map((s: any, idx: number) => (
                        <li key={idx}>{s.name} — <code>{s.email}</code> · temp password: <code>{s.temp_password}</code></li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground mt-1">Share these credentials securely. Use Users → Reset Password to change.</p>
                  </div>
                )}
                {detailLead.status !== 'converted' && students.length > 0 && (
                  <Button
                    className="w-full"
                    disabled={approveMutation.isPending || !assignOrgId}
                    onClick={() => approveMutation.mutate({ id: detailLead.id, organization_id: assignOrgId })}
                  >
                    {approveMutation.isPending
                      ? 'Creating accounts…'
                      : !assignOrgId
                        ? 'Assign organization to continue'
                        : `Approve & Create ${students.length} Student Account(s)`}
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
