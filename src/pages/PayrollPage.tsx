import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, DollarSign } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PayrollPage() {
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [form, setForm] = useState({ teacher_id: '', amount: '', month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()) });

  const load = async () => {
    setLoading(true);
    try {
      const [p, u] = await Promise.all([adminQuery('list_payroll'), adminQuery('list_users')]);
      setPayroll(p); setTeachers(u.filter((u: any) => u.role === 'teacher'));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.teacher_id || !form.amount) { toast.error('Teacher and amount required'); return; }
    try { await adminQuery('create_payroll', { teacher_id: form.teacher_id, amount: parseFloat(form.amount), month: parseInt(form.month), year: parseInt(form.year) }); toast.success('Payroll created'); setOpen(false); load(); } catch (e: any) { toast.error(e.message); }
  };

  const markPaid = async (id: string) => {
    try { await adminQuery('update_payroll', { id, status: 'paid', paid_at: new Date().toISOString() }); toast.success('Marked paid'); load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Payroll</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Payroll Entry</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Teacher</Label><Select value={form.teacher_id} onValueChange={v => setForm(f => ({ ...f, teacher_id: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{teachers.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.display_name || t.email}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Month</Label><Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} /></div>
              </div>
              <Button onClick={handleCreate} className="w-full">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Amount</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {payroll.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><DollarSign className="mx-auto h-8 w-8 mb-2 opacity-50" />No payroll entries</TableCell></TableRow> :
                payroll.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.teacher_profile?.display_name || p.teacher_profile?.email || p.teacher_id}</TableCell>
                    <TableCell>₹{p.amount}</TableCell>
                    <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
                    <TableCell><Badge variant={p.status === 'paid' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                    <TableCell>{p.status === 'pending' && <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>Mark Paid</Button>}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
