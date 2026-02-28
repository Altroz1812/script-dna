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
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: '', notes: '' });

  const { data: leads = [], isLoading } = useQuery<any[]>({
    queryKey: ['leads'],
    queryFn: () => adminQuery('list_leads'),
    staleTime: 1000 * 60 * 5,
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
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {leads.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No leads yet</TableCell></TableRow> :
                leads.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.email || '—'}</TableCell>
                    <TableCell>{l.phone || '—'}</TableCell>
                    <TableCell>{l.source || '—'}</TableCell>
                    <TableCell>
                      <Select value={l.status} onValueChange={v => updateStatusMutation.mutate({ id: l.id, status: v })}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
