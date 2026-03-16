import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string;
  max_students: number | null;
  max_courses: number | null;
  max_teachers: number | null;
  features: string[];
  is_active: boolean;
}

interface OrgSub {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  organizations: { name: string } | null;
  subscription_plans: { name: string; price: number; billing_cycle: string } | null;
}

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<OrgSub[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Plan form
  const [planOpen, setPlanOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pCycle, setPCycle] = useState('monthly');
  const [pMaxStudents, setPMaxStudents] = useState('');
  const [pMaxCourses, setPMaxCourses] = useState('');
  const [pMaxTeachers, setPMaxTeachers] = useState('');

  // Assign form
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignOrgId, setAssignOrgId] = useState('');
  const [assignPlanId, setAssignPlanId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [p, s, o] = await Promise.all([
        adminQuery('list_subscription_plans'),
        adminQuery('list_org_subscriptions'),
        adminQuery('list_organizations'),
      ]);
      setPlans(p); setSubs(s); setOrgs(o);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resetPlanForm = () => { setPName(''); setPDesc(''); setPPrice(''); setPCycle('monthly'); setPMaxStudents(''); setPMaxCourses(''); setPMaxTeachers(''); setEditPlan(null); };

  const openEditPlan = (p: Plan) => {
    setEditPlan(p); setPName(p.name); setPDesc(p.description || ''); setPPrice(String(p.price)); setPCycle(p.billing_cycle);
    setPMaxStudents(p.max_students ? String(p.max_students) : ''); setPMaxCourses(p.max_courses ? String(p.max_courses) : '');
    setPMaxTeachers(p.max_teachers ? String(p.max_teachers) : ''); setPlanOpen(true);
  };

  const handleSavePlan = async () => {
    if (!pName.trim()) { toast.error('Name required'); return; }
    const payload = {
      name: pName.trim(), description: pDesc.trim() || null, price: Number(pPrice) || 0,
      billing_cycle: pCycle,
      max_students: pMaxStudents ? Number(pMaxStudents) : null,
      max_courses: pMaxCourses ? Number(pMaxCourses) : null,
      max_teachers: pMaxTeachers ? Number(pMaxTeachers) : null,
    };
    try {
      if (editPlan) {
        await adminQuery('update_subscription_plan', { id: editPlan.id, ...payload });
        toast.success('Plan updated');
      } else {
        await adminQuery('create_subscription_plan', payload);
        toast.success('Plan created');
      }
      setPlanOpen(false); resetPlanForm(); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    try { await adminQuery('delete_subscription_plan', { id }); toast.success('Deleted'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleTogglePlan = async (p: Plan) => {
    try {
      await adminQuery('update_subscription_plan', { id: p.id, is_active: !p.is_active });
      toast.success(p.is_active ? 'Plan disabled' : 'Plan enabled');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAssign = async () => {
    if (!assignOrgId || !assignPlanId) { toast.error('Select org and plan'); return; }
    try {
      await adminQuery('assign_org_subscription', { organization_id: assignOrgId, plan_id: assignPlanId });
      toast.success('Subscription assigned');
      setAssignOpen(false); setAssignOrgId(''); setAssignPlanId(''); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCancelSub = async (orgId: string) => {
    if (!confirm('Cancel this subscription?')) return;
    try { await adminQuery('cancel_org_subscription', { organization_id: orgId }); toast.success('Cancelled'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN')}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><CreditCard className="h-6 w-6" /> Subscription Plans</h1>
          <p className="text-muted-foreground text-sm">Manage billing plans and institute subscriptions</p>
        </div>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans ({plans.length})</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions ({subs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={planOpen} onOpenChange={(v) => { if (!v) resetPlanForm(); setPlanOpen(v); }}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Plan</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={pName} onChange={e => setPName(e.target.value)} /></div>
                  <div><Label>Description</Label><Textarea value={pDesc} onChange={e => setPDesc(e.target.value)} rows={2} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Price (₹)</Label><Input type="number" value={pPrice} onChange={e => setPPrice(e.target.value)} /></div>
                    <div>
                      <Label>Billing Cycle</Label>
                      <Select value={pCycle} onValueChange={setPCycle}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Max Students</Label><Input type="number" value={pMaxStudents} onChange={e => setPMaxStudents(e.target.value)} placeholder="∞" /></div>
                    <div><Label>Max Courses</Label><Input type="number" value={pMaxCourses} onChange={e => setPMaxCourses(e.target.value)} placeholder="∞" /></div>
                    <div><Label>Max Teachers</Label><Input type="number" value={pMaxTeachers} onChange={e => setPMaxTeachers(e.target.value)} placeholder="∞" /></div>
                  </div>
                  <Button onClick={handleSavePlan} className="w-full">{editPlan ? 'Update' : 'Create'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? <TableSkeleton columns={6} rows={4} /> : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Limits</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No plans yet</TableCell></TableRow>
                    ) : plans.map(p => (
                      <TableRow key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                        <TableCell>
                          <div><span className="font-medium">{p.name}</span></div>
                          {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(p.price)}</TableCell>
                        <TableCell><Badge variant="secondary">{p.billing_cycle}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.max_students ?? '∞'} students · {p.max_courses ?? '∞'} courses · {p.max_teachers ?? '∞'} teachers
                        </TableCell>
                        <TableCell><Switch checked={p.is_active} onCheckedChange={() => handleTogglePlan(p)} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditPlan(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeletePlan(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Assign Plan</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign Subscription</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Organization</Label>
                    <Select value={assignOrgId} onValueChange={setAssignOrgId}>
                      <SelectTrigger><SelectValue placeholder="Select org..." /></SelectTrigger>
                      <SelectContent>{orgs.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                      <SelectTrigger><SelectValue placeholder="Select plan..." /></SelectTrigger>
                      <SelectContent>{plans.filter(p => p.is_active).map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}/{p.billing_cycle}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAssign} className="w-full">Assign</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? <TableSkeleton columns={5} rows={4} /> : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No subscriptions yet</TableCell></TableRow>
                    ) : subs.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.organizations?.name ?? '—'}</TableCell>
                        <TableCell>{s.subscription_plans?.name ?? '—'} <span className="text-muted-foreground text-xs">({formatCurrency(s.subscription_plans?.price ?? 0)}/{s.subscription_plans?.billing_cycle})</span></TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'active' ? 'default' : 'destructive'}>{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(s.starts_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {s.status === 'active' && (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleCancelSub(s.organization_id)}>Cancel</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
