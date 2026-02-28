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
import { Plus, CreditCard } from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [form, setForm] = useState({ student_id: '', amount: '', description: '', currency: 'INR' });

  const load = async () => {
    setLoading(true);
    try {
      const [p, u] = await Promise.all([adminQuery('list_payments'), adminQuery('list_users')]);
      setPayments(p); setStudents(u.filter((u: any) => u.role === 'student'));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.student_id || !form.amount) { toast.error('Student and amount required'); return; }
    try { await adminQuery('create_payment', { student_id: form.student_id, amount: parseFloat(form.amount), currency: form.currency, description: form.description || null }); toast.success('Payment recorded'); setOpen(false); setForm({ student_id: '', amount: '', description: '', currency: 'INR' }); load(); } catch (e: any) { toast.error(e.message); }
  };

  const updateStatus = async (id: string, status: string) => {
    try { await adminQuery('update_payment', { id, status }); toast.success('Updated'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const STATUS_COLORS: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', completed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800', refunded: 'bg-gray-100 text-gray-800' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Record Payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Student</Label><Select value={form.student_id} onValueChange={v => setForm(f => ({ ...f, student_id: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.display_name || s.email}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full">Record</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><CreditCard className="mx-auto h-8 w-8 mb-2 opacity-50" />No payments</TableCell></TableRow> :
                payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.student_profile?.display_name || p.student_profile?.email || p.student_id}</TableCell>
                    <TableCell>{p.currency} {p.amount}</TableCell>
                    <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{p.description || '—'}</TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={v => updateStatus(p.id, v)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
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
