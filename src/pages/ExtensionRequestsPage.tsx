import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminQuery } from '@/services/api/adminService';
import { useRBAC } from '@/hooks/useRBAC';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResponsiveDialog } from '@/components/mobile/ui';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, XCircle, IndianRupee, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function ExtensionRequestsPage() {
  const { isAdmin } = useRBAC();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['extension_requests', tab],
    queryFn: () => adminQuery('list_extension_requests', { status: tab }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => adminQuery('approve_extension_request', { id }),
    onSuccess: () => {
      toast.success('Approved');
      qc.invalidateQueries({ queryKey: ['extension_requests'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: () => adminQuery('reject_extension_request', { id: rejectId, reason: rejectReason }),
    onSuccess: () => {
      toast.success('Rejected');
      setRejectId(null); setRejectReason('');
      qc.invalidateQueries({ queryKey: ['extension_requests'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed'),
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Class Extension Requests</h1>
        <p className="text-sm text-muted-foreground">
          Teachers request additional classes (free or paid) for students who need improvement. Approve to unlock the batch for extra sessions.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              No {tab} requests.
            </CardContent></Card>
          ) : (
            rows.map((r: any) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {r.batches?.name || 'Batch'}
                    <Badge variant="outline" className="text-[10px]">
                      {r.batches?.courses?.name}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${r.extension_mode === 'paid' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'}`}
                    >
                      {r.extension_mode === 'paid' ? <IndianRupee className="h-3 w-3 mr-0.5 inline" /> : null}
                      {r.extension_mode}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {r.num_classes} extra classes</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {(r.students || []).length} student(s)</span>
                    {r.amount != null && (
                      <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" /> ₹{r.amount} total</span>
                    )}
                    <span>Requested by {r.requester?.display_name || r.requester?.email || '—'}</span>
                    <span>{format(new Date(r.created_at), 'dd MMM yyyy, h:mm a')}</span>
                  </div>
                  {(r.students || []).length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Students: </span>
                      {(r.students || []).map((s: any) => s.display_name || s.email || s.user_id).join(', ')}
                    </div>
                  )}
                  {r.reason && <p className="text-xs italic">"{r.reason}"</p>}
                  {r.rejected_reason && <p className="text-xs text-destructive">Rejected: {r.rejected_reason}</p>}
                  {r.status === 'pending' && isAdmin && (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => approveMut.mutate(r.id)} disabled={approveMut.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectId(r.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <ResponsiveDialog
        open={!!rejectId}
        onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectReason(''); } }}
        title="Reject Extension Request"
        desktopWidthClass="sm:max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={rejectMut.isPending} onClick={() => rejectMut.mutate()}>
              {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </>
        }
      >
        <Label className="text-xs">Reason</Label>
        <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why this is being rejected" />
      </ResponsiveDialog>
    </div>
  );
}