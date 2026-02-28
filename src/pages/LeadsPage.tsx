import { useEffect, useState } from 'react';
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
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const STATUS_COLORS: Record<string, string> = { new: 'bg-blue-100 text-blue-800', contacted: 'bg-yellow-100 text-yellow-800', qualified: 'bg-purple-100 text-purple-800', converted: 'bg-green-100 text-green-800', lost: 'bg-red-100 text-red-800' };

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: '', notes: '' });

  const load = () => { setLoading(true); adminQuery('list_leads').then(setLeads).catch(e => toast.error(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    try { await adminQuery('create_lead', { name: form.name.trim(), email: form.email || null, phone: form.phone || null, source: form.source || null, notes: form.notes || null }); toast.success('Lead created'); setOpen(false); setForm({ name: '', email: '', phone: '', source: '', notes: '' }); load(); } catch (e: any) { toast.error(e.message); }
  };

  const updateStatus = async (id: string, status: string) => {
    try { await adminQuery('update_lead', { id, status }); toast.success('Status updated'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await adminQuery('delete_lead', { id }); toast.success('Deleted'); load(); } catch (e: any) { toast.error(e.message); }
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
              <Button onClick={handleCreate} className="w-full">Create Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <TableSkeleton columns={6} rows={5} /> : (
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
                      <Select value={l.status} onValueChange={v => updateStatus(l.id, v)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
