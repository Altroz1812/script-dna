import { useEffect, useState } from "react";
import { adminQuery } from "@/services/api/adminService";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRBAC } from "@/hooks/useRBAC";
import { useActiveOrg } from "@/contexts/ActiveOrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FileText, Calendar, Download, ExternalLink, Upload, AlertCircle } from "lucide-react";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { format } from "date-fns";

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

export default function PracticeAssignmentsPage() {
  const { profile } = useAuth();
  const { role } = useRBAC();
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const { activeOrgId } = useActiveOrg();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", batch_id: "", due_date: "", file_url: "" });
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const normalizeUrl = (url: string): string => {
    const u = (url || "").trim();
    if (!u) return "";

    // Block javascript: and other dangerous protocols
    const dangerousProtocols = /^(javascript:|data:|vbscript:|file:)/i;
    if (dangerousProtocols.test(u)) {
      console.warn("Blocked dangerous URL protocol");
      return "";
    }

    if (/^(https?:|mailto:|tel:|\/)/i.test(u)) return u;
    return `https://${u}`;
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      const extension = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return { valid: false, error: "Only PDF and image files (JPG, PNG) are allowed" };
      }
    }

    return { valid: true };
  };

  const getAssignmentFileHref = (url: string): string => {
    const u = (url || "").trim();
    if (!u) return "";

    try {
      // Handle storage paths
      if (/^practice-assignments\//i.test(u)) {
        const { data } = supabase.storage.from("materials").getPublicUrl(u);
        return data.publicUrl;
      }

      if (/^materials\/practice-assignments\//i.test(u)) {
        const cleanPath = u.replace(/^materials\//i, "");
        const { data } = supabase.storage.from("materials").getPublicUrl(cleanPath);
        return data.publicUrl;
      }

      // Handle external URLs
      const normalized = normalizeUrl(u);
      if (!normalized) return "";

      const parsed = new URL(normalized, window.location.origin);
      const isAuraPenRoot = /(^|\.)aurapen\.com$/i.test(parsed.hostname) && parsed.pathname.replace(/\/$/, "") === "";

      if (isAuraPenRoot) return "";

      // Only allow http/https protocols
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }

      return "";
    } catch {
      return "";
    }
  };

  const handleFileUpload = async (file: File) => {
    // Check if user is authenticated
    if (!profile?.id) {
      toast.error("User not authenticated. Please log in again.");
      return;
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const timestamp = Date.now();
      const safeFileName = `${timestamp}.${ext}`;
      const path = `practice-assignments/${profile.id}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage.from("materials").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("materials").getPublicUrl(path);
      setForm((f) => ({ ...f, file_url: data.publicUrl }));
      toast.success("File uploaded successfully");
    } catch (e: any) {
      console.error("File upload error:", e);
      toast.error(e.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const load = async () => {
    // Don't load if no active organization
    if (!activeOrgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load assignments with better error handling
      let assignmentsData = [];
      try {
        assignmentsData = await adminQuery("list_practice_assignments");
      } catch (err) {
        console.error("Failed to load assignments:", err);
        toast.error("Unable to load assignments. Please refresh the page.");
        assignmentsData = [];
      }

      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);

      // Load batches only for teachers
      if (isTeacher) {
        try {
          const batchesData = await adminQuery("list_batches");
          setBatches(Array.isArray(batchesData) ? batchesData : []);
        } catch (err) {
          console.error("Failed to load batches:", err);
          toast.error("Unable to load batches");
          setBatches([]);
        }
      }
    } catch (e: any) {
      console.error("Load error:", e);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrgId && profile) {
      load();
    }
  }, [activeOrgId, profile, isTeacher]); // Added proper dependencies

  const handleCreate = async () => {
    // Validate required fields
    if (!form.title || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!form.batch_id) {
      toast.error("Please select a batch");
      return;
    }

    // Validate due date if provided
    if (form.due_date) {
      const dueDate = new Date(form.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        toast.error("Due date cannot be in the past");
        return;
      }
    }

    try {
      await adminQuery("create_practice_assignment", {
        teacher_id: profile?.id,
        batch_id: form.batch_id,
        title: form.title.trim(),
        description: form.description?.trim() || null,
        due_date: form.due_date || null,
        file_url: form.file_url ? normalizeUrl(form.file_url) : null,
      });

      toast.success("Assignment created successfully");
      setOpen(false);
      setForm({ title: "", description: "", batch_id: "", due_date: "", file_url: "" });
      await load(); // Wait for reload to complete
    } catch (e: any) {
      console.error("Create error:", e);
      toast.error(e.message || "Failed to create assignment");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assignment? This action cannot be undone.")) {
      return;
    }

    setDeletingId(id);
    try {
      await adminQuery("delete_practice_assignment", { id });
      toast.success("Assignment deleted successfully");
      await load(); // Wait for reload to complete
    } catch (e: any) {
      console.error("Delete error:", e);
      toast.error(e.message || "Failed to delete assignment");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !uploading) {
      setOpen(false);
      // Reset form when dialog closes
      setForm({ title: "", description: "", batch_id: "", due_date: "", file_url: "" });
    } else if (open === false && uploading) {
      toast.info("Please wait for file upload to complete");
      return;
    }
    setOpen(open);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Practice Assignments</h1>
          <p className="text-muted-foreground text-sm">
            {isStudent ? "Practice sheets assigned to you" : "Assign and manage practice sheets"}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button disabled={uploading}>
                <Plus className="mr-2 h-4 w-4" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Practice Assignment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g., Cursive Letter Practice"
                    maxLength={200}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Instructions for students..."
                    rows={3}
                    maxLength={1000}
                  />
                </div>

                <div>
                  <Label htmlFor="batch">Batch *</Label>
                  <Select value={form.batch_id} onValueChange={(v) => setForm((f) => ({ ...f, batch_id: v }))}>
                    <SelectTrigger id="batch">
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.length === 0 ? (
                        <SelectItem value="no-batches" disabled>
                          No batches available
                        </SelectItem>
                      ) : (
                        batches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="due_date">Due Date (optional)</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div>
                  <Label>Upload File (PDF or image, optional, max 10MB)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                      e.target.value = ""; // Allow re-uploading same file
                    }}
                    disabled={uploading}
                  />
                  {uploading && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Upload className="h-3 w-3 animate-spin" />
                      Uploading...
                    </p>
                  )}
                </div>

                <div>
                  <Label>Or paste a Reference URL</Label>
                  <Input
                    value={form.file_url}
                    onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))}
                    placeholder="https://example.com/sheet.pdf"
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Only HTTP/HTTPS URLs are allowed</p>
                </div>

                <Button
                  onClick={handleCreate}
                  className="w-full"
                  disabled={!form.title.trim() || !form.batch_id || uploading || batches.length === 0}
                >
                  {uploading ? "Uploading file..." : "Create Assignment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <TableSkeleton columns={isStudent ? 4 : 4} rows={5} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>{isStudent ? "Download" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        No assignments yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.map((a) => {
                      const fileHref = a.file_url ? getAssignmentFileHref(a.file_url) : "";
                      const hasValidFile = a.file_url && fileHref;

                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{a.title}</span>
                              {a.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{a.batches?.name || "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            {a.due_date ? (
                              <span className="flex items-center gap-1 text-sm whitespace-nowrap">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                {format(new Date(a.due_date), "MMM d, yyyy")}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {hasValidFile ? (
                                <Button variant="ghost" size="sm" asChild>
                                  <a
                                    href={fileHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center"
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    {isStudent ? "Download" : "View"}
                                  </a>
                                </Button>
                              ) : a.file_url ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  onClick={() => toast.error("No valid document is linked to this assignment")}
                                  className="text-muted-foreground"
                                >
                                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                                  Invalid link
                                </Button>
                              ) : null}

                              {isTeacher && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(a.id)}
                                  disabled={deletingId === a.id}
                                >
                                  {deletingId === a.id ? "..." : "Delete"}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
