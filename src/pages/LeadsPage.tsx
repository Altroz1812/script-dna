import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminQuery } from "@/services/api/adminService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Eye, CheckCircle2 } from "lucide-react";
import { TableSkeleton } from "@/components/ui/loading-skeletons";

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", source: "", notes: "" });
  const [detailLead, setDetailLead] = useState<any | null>(null);
  const [assignOrgId, setAssignOrgId] = useState<string>("");
  const [payForm, setPayForm] = useState<{
    method: string;
    reference: string;
    status: "pending" | "completed";
    date: string;
    notes: string;
  }>({ method: "cash", reference: "", status: "completed", date: new Date().toISOString().slice(0, 10), notes: "" });

  const { data: leads = [], isLoading } = useQuery<any[]>({
    queryKey: ["leads"],
    queryFn: () => adminQuery("list_leads"),
    staleTime: 1000 * 60 * 5,
  });

  const { data: organizations = [] } = useQuery<any[]>({
    queryKey: ["organizations"],
    queryFn: () => adminQuery("list_organizations"),
    staleTime: 1000 * 60 * 10,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      adminQuery("create_lead", {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      toast.success("Lead created");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", source: "", notes: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminQuery("update_lead", { id, status }),
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminQuery("delete_lead", { id }),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      organization_id,
      payment_method,
      reference_number,
      payment_status,
      payment_date,
      payment_notes,
    }: {
      id: string;
      organization_id?: string;
      payment_method?: string;
      reference_number?: string;
      payment_status?: "pending" | "completed";
      payment_date?: string;
      payment_notes?: string;
    }) =>
      adminQuery("approve_lead", {
        id,
        organization_id,
        payment_method,
        reference_number,
        payment_status,
        payment_date,
        payment_notes,
      }),
    onSuccess: (data: any) => {
      const errs = Array.isArray(data?.errors) ? data.errors : [];
      toast.success(
        `Created ${data?.created_count ?? 0} student(s), enrolled ${data?.enrolled_count ?? 0}, ${data?.payments_count ?? 0} payment(s)`,
      );
      if (errs.length) toast.warning(`${errs.length} issue(s): ${errs.slice(0, 2).join("; ")}`);
      setDetailLead(null);
      setAssignOrgId("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm">CRM lead tracking</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Source</Label>
                <Input
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  placeholder="e.g. Website, Referral"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Creating..." : "Create Lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <TableSkeleton columns={6} rows={5} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Courses / Batches</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No leads yet
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((l) => {
                    const meta = l.metadata ?? {};
                    const students = Array.isArray(meta.students) ? meta.students : [];
                    const itemsM = Array.isArray(meta.items) ? meta.items : [];
                    const isCheckout = l.source === "checkout" || students.length > 0;

                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.name}
                          {isCheckout && (
                            <Badge variant="secondary" className="ml-2">
                              Checkout
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{l.email || "—"}</TableCell>
                        <TableCell>{l.source || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {students.length > 0
                            ? students.map((s: any) => `${s.name} (${s.grade || "—"})`).join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {itemsM.length > 0
                            ? itemsM
                                .map((i: any) => `${i.course_name}${i.batch_name ? ` · ${i.batch_name}` : ""}`)
                                .join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={l.status}
                            onValueChange={(v) => updateStatusMutation.mutate({ id: l.id, status: v })}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isCheckout && (
                              <Button variant="ghost" size="icon" title="View details" onClick={() => setDetailLead(l)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {isCheckout && l.status !== "converted" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={
                                  l.organization_id ? "Approve & create students" : "Open to assign organization first"
                                }
                                onClick={() => {
                                  setAssignOrgId(l.organization_id || "");
                                  setDetailLead(l);
                                }}
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
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Detail Dialog with Tabs */}
      <Dialog
        open={!!detailLead}
        onOpenChange={(o) => {
          if (!o) {
            setDetailLead(null);
            setAssignOrgId("");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Order / Checkout Details</DialogTitle>
          </DialogHeader>

          {detailLead &&
            (() => {
              const meta = detailLead.metadata ?? {};
              const students = Array.isArray(meta.students) ? meta.students : [];
              const itemsM = Array.isArray(meta.items) ? meta.items : [];
              const createdStudents = Array.isArray(meta.created_students) ? meta.created_students : [];

              const isConverted = detailLead.status === "converted";

              return (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <Tabs defaultValue="parent" className="flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="parent">Parent</TabsTrigger>
                      <TabsTrigger value="students">Students</TabsTrigger>
                      <TabsTrigger value="address">Address</TabsTrigger>
                      <TabsTrigger value="payment">Payment</TabsTrigger>
                      <TabsTrigger value="items">Courses &amp; Batches</TabsTrigger>
                    </TabsList>

                    {/* Parent Tab */}
                    <TabsContent value="parent" className="flex-1 overflow-auto p-4 border rounded-md mt-2">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-muted-foreground">Parent Name</Label>
                          <div className="text-lg font-medium mt-1">{meta.parent_name || detailLead.name}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Email</Label>
                          <div className="mt-1">{meta.parent_email || detailLead.email || "—"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Phone</Label>
                          <div className="mt-1">{meta.parent_phone || detailLead.phone || "—"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Source</Label>
                          <div className="mt-1 capitalize">{detailLead.source || "—"}</div>
                        </div>
                      </div>

                      {detailLead.notes && (
                        <div className="mt-6">
                          <Label className="text-muted-foreground">Notes</Label>
                          <p className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">{detailLead.notes}</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Students Tab */}
                    <TabsContent value="students" className="flex-1 overflow-auto p-4 border rounded-md mt-2">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-muted-foreground mb-2 block">Students ({students.length})</Label>
                          {students.length > 0 ? (
                            <div className="space-y-3">
                              {students.map((s: any, idx: number) => (
                                <Card key={idx}>
                                  <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="font-medium">{s.name}</div>
                                        <div className="text-sm text-muted-foreground">Grade {s.grade || "—"}</div>
                                      </div>
                                      <Badge variant="outline">{s.course_name}</Badge>
                                    </div>
                                    {s.batch_name && (
                                      <p className="text-sm text-muted-foreground mt-1">Batch: {s.batch_name}</p>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">No students attached to this order.</p>
                          )}
                        </div>

                        {createdStudents.length > 0 && (
                          <div>
                            <Label className="text-muted-foreground mb-2 block">Created Student Accounts</Label>
                            <div className="space-y-3">
                              {createdStudents.map((s: any, idx: number) => (
                                <Card key={idx}>
                                  <CardContent className="p-4">
                                    <div className="flex justify-between">
                                      <div>
                                        <div>{s.name}</div>
                                        <code className="text-xs text-muted-foreground">{s.email}</code>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-xs text-muted-foreground">Temp Password</div>
                                        <code className="font-mono text-sm">{s.temp_password}</code>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                              Share credentials securely. Use Users → Reset Password later.
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Address Tab */}
                    <TabsContent value="address" className="flex-1 overflow-auto p-4 border rounded-md mt-2">
                      <div className="space-y-4">
                        {meta.address || meta.shipping_address ? (
                          <div className="grid gap-4">
                            <div>
                              <Label className="text-muted-foreground">Address Line 1</Label>
                              <div className="mt-1">{meta.address?.line1 || meta.shipping_address?.line1 || "—"}</div>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Address Line 2</Label>
                              <div className="mt-1">{meta.address?.line2 || meta.shipping_address?.line2 || "—"}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-muted-foreground">City</Label>
                                <div className="mt-1">{meta.address?.city || meta.shipping_address?.city || "—"}</div>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">State / Province</Label>
                                <div className="mt-1">{meta.address?.state || meta.shipping_address?.state || "—"}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-muted-foreground">Country</Label>
                                <div className="mt-1">
                                  {meta.address?.country || meta.shipping_address?.country || "—"}
                                </div>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Pincode / ZIP</Label>
                                <div className="mt-1">
                                  {meta.address?.pincode || meta.shipping_address?.pincode || "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">No address information available for this order.</p>
                        )}
                      </div>
                    </TabsContent>

                    {/* Payment Tab */}
                    <TabsContent value="payment" className="flex-1 overflow-auto p-4 border rounded-md mt-2">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-muted-foreground">Payment Method</Label>
                          <div className="text-lg font-medium mt-1 capitalize">{meta.payment_method || "—"}</div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Final Amount</Label>
                          <div className="text-2xl font-semibold mt-1">
                            ₹{meta.final_amount?.toLocaleString() ?? "—"}
                          </div>
                        </div>
                        {meta.payment_id && (
                          <div>
                            <Label className="text-muted-foreground">Transaction ID</Label>
                            <div className="font-mono text-sm mt-1">{meta.payment_id}</div>
                          </div>
                        )}
                        {meta.payment_status && (
                          <div>
                            <Label className="text-muted-foreground">Payment Status</Label>
                            <Badge className="mt-1" variant={meta.payment_status === "paid" ? "default" : "secondary"}>
                              {meta.payment_status}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Courses & Batches Tab */}
                    <TabsContent value="items" className="flex-1 overflow-auto p-4 border rounded-md mt-2">
                      <Label className="text-muted-foreground mb-3 block">Purchased Items ({itemsM.length})</Label>
                      {itemsM.length > 0 ? (
                        <div className="space-y-4">
                          {itemsM.map((i: any, idx: number) => (
                            <Card key={idx}>
                              <CardContent className="p-5">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-semibold text-lg">{i.course_name}</div>
                                    {i.batch_name && <div className="text-muted-foreground">Batch: {i.batch_name}</div>}
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xl font-semibold">₹{i.fee}</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No course/batch items found.</p>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* Approval Section (outside tabs) */}
                  {!isConverted && students.length > 0 && (
                    <div className="border-t pt-4 mt-4 space-y-4">
                      <div>
                        <Label>Assign Organization *</Label>
                        <Select value={assignOrgId} onValueChange={setAssignOrgId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select organization..." />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((o: any) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                        <div className="text-sm font-medium">Record Payment</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Method</Label>
                            <Select
                              value={payForm.method}
                              onValueChange={(v) => setPayForm((f) => ({ ...f, method: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="upi">UPI</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                                <SelectItem value="card">Card (POS)</SelectItem>
                                <SelectItem value="cashfree">Cashfree (Online)</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Status</Label>
                            <Select
                              value={payForm.status}
                              onValueChange={(v: "pending" | "completed") =>
                                setPayForm((f) => ({ ...f, status: v }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="completed">Paid Now</SelectItem>
                                <SelectItem value="pending">Pay Later</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Reference No.</Label>
                            <Input
                              value={payForm.reference}
                              onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
                              placeholder="UTR / Txn / Cheque #"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Payment Date</Label>
                            <Input
                              type="date"
                              value={payForm.date}
                              onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Notes</Label>
                            <Input
                              value={payForm.notes}
                              onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                              placeholder="Optional remarks"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          One payment row per student will be created under the selected organization
                          (₹{meta.final_amount?.toLocaleString() ?? 0} total across {students.length} student
                          {students.length === 1 ? "" : "s"}).
                        </p>
                      </div>

                      <Button
                        className="w-full"
                        disabled={approveMutation.isPending || !assignOrgId}
                        onClick={() =>
                          approveMutation.mutate({
                            id: detailLead.id,
                            organization_id: assignOrgId,
                            payment_method: payForm.method,
                            reference_number: payForm.reference || undefined,
                            payment_status: payForm.status,
                            payment_date: payForm.date,
                            payment_notes: payForm.notes || undefined,
                          })
                        }
                      >
                        {approveMutation.isPending
                          ? "Creating accounts & payments…"
                          : `Approve, Create ${students.length} Account(s) & Record Payment`}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
