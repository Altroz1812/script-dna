import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { TableSkeleton } from '@/components/ui/loading-skeletons';

export default function PaymentsPage() {
  const { profile } = useAuth();
  const isParent = profile?.role === 'parent';
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [childrenForPayment, setChildrenForPayment] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ student_id: '', amount: '', description: '', currency: 'INR' });

  const loadAdmin = async () => {
    setLoading(true);
    try {
      const [p, u] = await Promise.all([adminQuery('list_payments'), adminQuery('list_users')]);
      setPayments(p); setStudents(u.filter((u: any) => u.role === 'student'));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const loadParent = async () => {
    setLoading(true);
    try {
      // Get children
      const { data: links } = await supabase.from('parent_children').select('child_id').eq('parent_id', profile!.id);
      const childIds = (links || []).map(l => l.child_id);
      
      const [paymentsRes, profilesRes] = await Promise.all([
        supabase.from('payments').select('*').order('payment_date', { ascending: false }),
        childIds.length > 0 ? supabase.from('profiles').select('user_id, display_name, email').in('user_id', childIds) : { data: [] },
      ]);
      
      setPayments(paymentsRes.data || []);
      setChildrenForPayment((profilesRes.data || []).map((p: any) => ({ id: p.user_id, name: p.display_name || p.email || p.user_id })));
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!profile) return;
    if (isParent) loadParent(); else loadAdmin();
  }, [profile]);

  const handleCreate = async () => {
    if (!form.student_id || !form.amount) { toast.error('Student and amount required'); return; }
    if (isParent) {
      try {
        const { error } = await supabase.from('payments').insert({
          student_id: form.student_id,
          amount: parseFloat(form.amount),
          currency: form.currency,
          description: form.description || null,
        });
        if (error) throw error;
        toast.success('Payment recorded'); setOpen(false); setForm({ student_id: '', amount: '', description: '', currency: 'INR' }); loadParent();
      } catch (e: any) { toast.error(e.message); }
    } else {
      try { await adminQuery('create_payment', { student_id: form.student_id, amount: parseFloat(form.amount), currency: form.currency, description: form.description || null }); toast.success('Payment recorded'); setOpen(false); setForm({ student_id: '', amount: '', description: '', currency: 'INR' }); loadAdmin(); } catch (e: any) { toast.error(e.message); }
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try { await adminQuery('update_payment', { id, status }); toast.success('Updated'); loadAdmin(); } catch (e: any) { toast.error(e.message); }
  };

  const selectItems = isParent ? childrenForPayment : students;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{isParent ? 'Pay Now' : 'Record Payment'}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{isParent ? 'Make Payment' : 'Record Payment'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{isParent ? 'Child' : 'Student'}</Label>
                <Select value={form.student_id} onValueChange={v => setForm(f => ({ ...f, student_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {selectItems.map(s => (
                      <SelectItem key={isParent ? (s as any).id : (s as any).user_id} value={isParent ? (s as any).id : (s as any).user_id}>
                        {isParent ? (s as any).name : ((s as any).display_name || (s as any).email)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <Button onClick={handleCreate} className="w-full">{isParent ? 'Pay' : 'Record'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <TableSkeleton columns={5} rows={5} /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><CreditCard className="mx-auto h-8 w-8 mb-2 opacity-50" />No payments</TableCell></TableRow> :
                payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {isParent
                        ? (childrenForPayment.find(c => c.id === p.student_id)?.name || p.student_id)
                        : (p.student_profile?.display_name || p.student_profile?.email || p.student_id)}
                    </TableCell>
                    <TableCell>{p.currency} {p.amount}</TableCell>
                    <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{p.description || '—'}</TableCell>
                    <TableCell>
                      {isParent ? (
                        <Badge variant={p.status === 'completed' ? 'default' : p.status === 'failed' ? 'destructive' : 'secondary'}>{p.status}</Badge>
                      ) : (
                        <Select value={p.status} onValueChange={v => updateStatus(p.id, v)}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
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
