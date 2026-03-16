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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Ticket, Search } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  min_amount: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Coupon | null>(null);

  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [discType, setDiscType] = useState('percentage');
  const [discValue, setDiscValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const load = () => {
    setLoading(true);
    adminQuery('list_coupons').then(setCoupons).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setCode(''); setDesc(''); setDiscType('percentage'); setDiscValue(''); setMaxUses(''); setMinAmount(''); setValidUntil(''); setEdit(null); };

  const openEdit = (c: Coupon) => {
    setEdit(c); setCode(c.code); setDesc(c.description || ''); setDiscType(c.discount_type);
    setDiscValue(String(c.discount_value)); setMaxUses(c.max_uses ? String(c.max_uses) : '');
    setMinAmount(c.min_amount ? String(c.min_amount) : '');
    setValidUntil(c.valid_until ? c.valid_until.split('T')[0] : '');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!code.trim()) { toast.error('Coupon code required'); return; }
    const payload = {
      code: code.trim().toUpperCase(),
      description: desc.trim() || null,
      discount_type: discType,
      discount_value: Number(discValue) || 0,
      max_uses: maxUses ? Number(maxUses) : null,
      min_amount: Number(minAmount) || 0,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
    };
    try {
      if (edit) {
        await adminQuery('update_coupon', { id: edit.id, ...payload });
        toast.success('Coupon updated');
      } else {
        await adminQuery('create_coupon', payload);
        toast.success('Coupon created');
      }
      setOpen(false); resetForm(); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    try { await adminQuery('delete_coupon', { id }); toast.success('Deleted'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async (c: Coupon) => {
    try {
      await adminQuery('update_coupon', { id: c.id, is_active: !c.is_active });
      toast.success(c.is_active ? 'Coupon disabled' : 'Coupon enabled');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = coupons.filter(c => !search || c.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Ticket className="h-6 w-6" /> Coupons</h1>
          <p className="text-muted-foreground text-sm">Manage discount codes</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Coupon</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Code</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="SUMMER25" className="uppercase" /></div>
              <div><Label>Description</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={discType} onValueChange={setDiscType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Value</Label><Input type="number" value={discValue} onChange={e => setDiscValue(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Max Uses</Label><Input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" /></div>
                <div><Label>Min Amount (₹)</Label><Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} /></div>
              </div>
              <div><Label>Valid Until</Label><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
              <Button onClick={handleSave} className="w-full">{edit ? 'Update' : 'Create'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search coupons..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? <TableSkeleton columns={6} rows={4} /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No coupons found</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id} className={!c.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <span className="font-mono font-bold">{c.code}</span>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {c.discount_type === 'percentage' ? `${c.discount_value}%` : `₹${c.discount_value}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.used_count} / {c.max_uses ?? '∞'}</TableCell>
                    <TableCell className="text-muted-foreground">{c.valid_until ? new Date(c.valid_until).toLocaleDateString() : '—'}</TableCell>
                    <TableCell><Switch checked={c.is_active} onCheckedChange={() => handleToggle(c)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
