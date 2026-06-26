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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeader, ResponsiveDialog } from "@/components/mobile/ui";
import {
  Plus,
  FileText,
  Calendar,
  Download,
  ExternalLink,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  MessageSquare,
  Star,
} from "lucide-react";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { format } from "date-fns";

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  file_url: string;
  batch_id: string;
  module_id: string;
  lesson_id: string;
  created_at: string;
  batches?: { name: string };
  modules?: { title: string };
  lessons?: { title: string };
  submissions?: Submission[];
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_url: string;
  submitted_at: string;
  grade: number;
  feedback: string;
  reviewed_at: string;
  reviewer_id: string;
  status: "pending" | "submitted" | "reviewed" | "late";
}

export default function PracticeAssignmentsPage() {
  const { profile } = useAuth();
  const { role, isAdmin } = useRBAC();
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const canCreate = isTeacher || isAdmin;
  const { activeOrgId } = useActiveOrg();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    batch_id: "",
    due_date: "",
    file_url: "",
    module_id: "",
    lesson_id: "",
  });
  const [modules, setModules] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Submission dialog states
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Review dialog states (for teachers)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewGrade, setReviewGrade] = useState<number>(0);
  const [reviewFeedback, setReviewFeedback] = useState("");

  const normalizeUrl = (url: string): string => {
    const u = (url || "").trim();
    if (!u) return "";

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
      if (/^practice-assignments\//i.test(u)) {
        const { data } = supabase.storage.from("materials").getPublicUrl(u);
        return data.publicUrl;
      }

      if (/^materials\/practice-assignments\//i.test(u)) {
        const cleanPath = u.replace(/^materials\//i, "");
        const { data } = supabase.storage.from("materials").getPublicUrl(cleanPath);
        return data.publicUrl;
      }

      const normalized = normalizeUrl(u);
      if (!normalized) return "";

      const parsed = new URL(normalized, window.location.origin);
      const isAuraPenRoot = /(^|\.)aurapen\.com$/i.test(parsed.hostname) && parsed.pathname.replace(/\/$/, "") === "";

      if (isAuraPenRoot) return "";

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }

      return "";
    } catch {
      return "";
    }
  };

  const handleFileUpload = async (file: File, folder: string = "practice-assignments") => {
    if (!profile?.id) {
      toast.error("User not authenticated. Please log in again.");
      return;
    }

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
      const path = `${folder}/${profile.id}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage.from("materials").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("materials").getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      console.error("File upload error:", e);
      toast.error(e.message || "Failed to upload file");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCreateAssignmentFileUpload = async (file: File) => {
    const url = await handleFileUpload(file, "practice-assignments");
    if (url) {
      setForm((f) => ({ ...f, file_url: url }));
      toast.success("File uploaded successfully");
    }
  };

  const handleSubmissionUpload = async (file: File) => {
    const url = await handleFileUpload(file, "submissions");
    if (url) {
      return url;
    }
    return null;
  };

  const load = async () => {
    if (!activeOrgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let assignmentsData = [];
      try {
        // Load assignments with submissions based on role
        if (isStudent) {
          assignmentsData = await adminQuery("list_student_practice_assignments", {
            student_id: profile?.id,
          });
        } else {
          assignmentsData = await adminQuery("list_practice_assignments");
        }
      } catch (err) {
        console.error("Failed to load assignments:", err);
        toast.error("Unable to load assignments. Please refresh the page.");
        assignmentsData = [];
      }

      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);

      if (canCreate) {
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
  }, [activeOrgId, profile, canCreate, isStudent]);

  // Load modules + lessons for the selected batch's course
  useEffect(() => {
    const loadModules = async () => {
      const batch = batches.find((b) => b.id === form.batch_id);
      const courseId = batch?.course_id;
      if (!courseId) {
        setModules([]);
        return;
      }
      try {
        const data = await adminQuery("list_course_modules", { course_id: courseId });
        setModules(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load modules", e);
        setModules([]);
      }
    };
    loadModules();
  }, [form.batch_id, batches]);

  const selectedModule = modules.find((m) => m.id === form.module_id);
  const lessonsForModule: any[] = selectedModule?.lessons ?? [];

  const handleLessonPick = (lessonId: string) => {
    const lesson = lessonsForModule.find((l) => l.id === lessonId);
    setForm((f) => ({
      ...f,
      lesson_id: lessonId,
      title: f.title || lesson?.title || "",
      file_url: f.file_url || lesson?.file_url || "",
    }));
  };

  const handleCreate = async () => {
    if (!form.title || !form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!form.batch_id) {
      toast.error("Please select a batch");
      return;
    }

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
        module_id: form.module_id || null,
        lesson_id: form.lesson_id || null,
      });

      toast.success("Assignment created successfully");
      setOpen(false);
      setForm({ title: "", description: "", batch_id: "", due_date: "", file_url: "", module_id: "", lesson_id: "" });
      await load();
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
      await load();
    } catch (e: any) {
      console.error("Delete error:", e);
      toast.error(e.message || "Failed to delete assignment");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment || !submissionFile) {
      toast.error("Please select a file to submit");
      return;
    }

    setSubmitting(true);
    try {
      const submissionUrl = await handleSubmissionUpload(submissionFile);
      if (!submissionUrl) {
        toast.error("Failed to upload submission");
        return;
      }

      await adminQuery("submit_practice_assignment", {
        assignment_id: selectedAssignment.id,
        student_id: profile?.id,
        submission_url: submissionUrl,
        submission_notes: submissionNotes,
      });

      toast.success("Assignment submitted successfully!");
      setSubmissionDialogOpen(false);
      setSubmissionFile(null);
      setSubmissionNotes("");
      setSelectedAssignment(null);
      await load();
    } catch (e: any) {
      console.error("Submission error:", e);
      toast.error(e.message || "Failed to submit assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmission = async () => {
    if (!selectedSubmission) return;

    try {
      await adminQuery("review_practice_assignment", {
        submission_id: selectedSubmission.id,
        grade: reviewGrade,
        feedback: reviewFeedback,
        reviewer_id: profile?.id,
      });

      toast.success("Submission reviewed successfully!");
      setReviewDialogOpen(false);
      setSelectedSubmission(null);
      setReviewGrade(0);
      setReviewFeedback("");
      await load();
    } catch (e: any) {
      console.error("Review error:", e);
      toast.error(e.message || "Failed to review submission");
    }
  };

  const getSubmissionStatusBadge = (submission?: Submission) => {
    if (!submission) {
      return (
        <Badge variant="outline" className="bg-gray-100">
          <Clock className="h-3 w-3 mr-1" />
          Not Submitted
        </Badge>
      );
    }

    switch (submission.status) {
      case "submitted":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "reviewed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Reviewed
          </Badge>
        );
      case "late":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Late
          </Badge>
        );
      default:
        return <Badge variant="outline">{submission.status}</Badge>;
    }
  };

  const isAssignmentOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !uploading) {
      setOpen(false);
      setForm({ title: "", description: "", batch_id: "", due_date: "", file_url: "", module_id: "", lesson_id: "" });
    } else if (open === false && uploading) {
      toast.info("Please wait for file upload to complete");
      return;
    }
    setOpen(open);
  };

  // Student View Columns
  const studentColumns = [
    "Assignment Details",
    "Module/Lesson",
    "Due Date",
    "Your Submission",
    "Grade & Feedback",
    "Actions",
  ];

  // Teacher View Columns
  const teacherColumns = ["Title", "Batch", "Module/Lesson", "Due Date", "Submissions", "Actions"];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Practice Assignments"
        description={isStudent ? "Complete and submit your practice assignments" : "Create and manage practice assignments"}
        primaryAction={canCreate ? (
          <Button disabled={uploading} onClick={() => handleDialogClose(true)} className="tap-target">
            <Plus className="mr-2 h-4 w-4" />
            New Assignment
          </Button>
        ) : undefined}
      />
      {canCreate && (
        <ResponsiveDialog
          open={open}
          onOpenChange={handleDialogClose}
          title="Create Practice Assignment"
          desktopWidthClass="sm:max-w-2xl"
          footer={
            <Button
              onClick={handleCreate}
              disabled={!form.title.trim() || !form.batch_id || uploading || batches.length === 0}
            >
              {uploading ? "Uploading file..." : "Create Assignment"}
            </Button>
          }
        >
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
                  <Label htmlFor="description">Description / Instructions *</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Provide detailed instructions for students..."
                    rows={4}
                    maxLength={1000}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Include submission requirements, format guidelines, and any special instructions
                  </p>
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
                  <Label htmlFor="module">Module (optional)</Label>
                  <Select
                    value={form.module_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, module_id: v, lesson_id: "" }))}
                    disabled={!form.batch_id || modules.length === 0}
                  >
                    <SelectTrigger id="module">
                      <SelectValue
                        placeholder={
                          !form.batch_id
                            ? "Select a batch first"
                            : modules.length === 0
                              ? "No modules in this course"
                              : "Select module"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="lesson">Lesson (optional — autofills title & file)</Label>
                  <Select
                    value={form.lesson_id}
                    onValueChange={handleLessonPick}
                    disabled={!form.module_id || lessonsForModule.length === 0}
                  >
                    <SelectTrigger id="lesson">
                      <SelectValue
                        placeholder={
                          !form.module_id
                            ? "Select a module first"
                            : lessonsForModule.length === 0
                              ? "No lessons in this module"
                              : "Select lesson"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {lessonsForModule.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.title}
                        </SelectItem>
                      ))}
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
                  <Label>Upload Assignment File (PDF or image, optional, max 10MB)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCreateAssignmentFileUpload(f);
                      e.target.value = "";
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
          </div>
        </ResponsiveDialog>
      )}

      {loading ? (
        <TableSkeleton columns={isStudent ? 6 : 6} rows={5} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(isStudent ? studentColumns : teacherColumns).map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        No assignments yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.map((assignment) => {
                      const fileHref = assignment.file_url ? getAssignmentFileHref(assignment.file_url) : "";
                      const hasValidFile = assignment.file_url && fileHref;
                      const submission = assignment.submissions?.[0];
                      const isOverdue = isAssignmentOverdue(assignment.due_date);
                      const canSubmit =
                        isStudent && !submission && (!isOverdue || new Date() < new Date(assignment.due_date));

                      if (isStudent) {
                        return (
                          <TableRow key={assignment.id} className={isOverdue && !submission ? "bg-red-50/50" : ""}>
                            <TableCell className="min-w-[250px]">
                              <div>
                                <div className="font-semibold text-foreground">{assignment.title}</div>
                                {assignment.description && (
                                  <div className="mt-2 p-2 bg-muted/30 rounded-md">
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                      {assignment.description}
                                    </p>
                                  </div>
                                )}
                                {hasValidFile && (
                                  <a
                                    href={fileHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    View Assignment Materials
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {assignment.modules?.title && (
                                  <div className="text-sm">
                                    <span className="font-medium">Module:</span> {assignment.modules.title}
                                  </div>
                                )}
                                {assignment.lessons?.title && (
                                  <div className="text-sm">
                                    <span className="font-medium">Lesson:</span> {assignment.lessons.title}
                                  </div>
                                )}
                                {!assignment.modules?.title && !assignment.lessons?.title && (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {assignment.due_date ? (
                                  <>
                                    <div className="flex items-center gap-1 text-sm">
                                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                      {format(new Date(assignment.due_date), "MMM d, yyyy h:mm a")}
                                    </div>
                                    {isOverdue && !submission && (
                                      <Badge variant="destructive" className="text-xs">
                                        Overdue
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">No due date</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getSubmissionStatusBadge(submission)}
                              {submission?.submitted_at && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Submitted: {format(new Date(submission.submitted_at), "MMM d, yyyy")}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {submission?.status === "reviewed" ? (
                                <div className="space-y-2">
                                  {submission.grade !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <Star className="h-4 w-4 text-yellow-500" />
                                      <span className="font-semibold">Grade: {submission.grade}/100</span>
                                    </div>
                                  )}
                                  {submission.feedback && (
                                    <div className="p-2 bg-muted/30 rounded-md">
                                      <div className="flex items-center gap-1 text-sm font-medium mb-1">
                                        <MessageSquare className="h-3 w-3" />
                                        Teacher Feedback:
                                      </div>
                                      <p className="text-sm text-muted-foreground">{submission.feedback}</p>
                                    </div>
                                  )}
                                  {submission.submission_url && (
                                    <a
                                      href={getAssignmentFileHref(submission.submission_url)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      View Your Submission
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {!submission ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAssignment(assignment);
                                    setSubmissionDialogOpen(true);
                                  }}
                                  disabled={isOverdue}
                                >
                                  <Upload className="h-3.5 w-3.5 mr-1" />
                                  Submit
                                </Button>
                              ) : (
                                submission.status === "submitted" && (
                                  <div className="text-sm text-yellow-600">Awaiting review</div>
                                )
                              )}
                              {submission?.submission_url && submission.status === "reviewed" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    window.open(getAssignmentFileHref(submission.submission_url), "_blank");
                                  }}
                                >
                                  <Download className="h-3.5 w-3.5 mr-1" />
                                  Download Submission
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      } else {
                        // Teacher View
                        const submissionCount = assignment.submissions?.length || 0;
                        const pendingCount =
                          assignment.submissions?.filter((s) => s.status === "submitted").length || 0;

                        return (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div>
                                <span className="font-medium">{assignment.title}</span>
                                {assignment.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {assignment.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{assignment.batches?.name || "—"}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {assignment.modules?.title && <div className="text-xs">{assignment.modules.title}</div>}
                                {assignment.lessons?.title && (
                                  <div className="text-xs text-muted-foreground">{assignment.lessons.title}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {assignment.due_date ? (
                                <span className="flex items-center gap-1 text-sm whitespace-nowrap">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  {format(new Date(assignment.due_date), "MMM d, yyyy")}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="text-sm">
                                  <span className="font-medium">Total: {submissionCount}</span>
                                  {pendingCount > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                      {pendingCount} pending
                                    </Badge>
                                  )}
                                </div>
                                {assignment.submissions?.slice(0, 2).map((sub) => (
                                  <div key={sub.id} className="text-xs text-muted-foreground">
                                    {sub.student_id}: {sub.status}
                                  </div>
                                ))}
                                {submissionCount > 2 && (
                                  <div className="text-xs text-primary cursor-pointer hover:underline">
                                    +{submissionCount - 2} more
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {hasValidFile && (
                                  <Button variant="ghost" size="sm" asChild>
                                    <a href={fileHref} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                      View
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Open submissions list dialog
                                    toast.info(`View submissions for ${assignment.title}`);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Submissions
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(assignment.id)}
                                  disabled={deletingId === assignment.id}
                                >
                                  {deletingId === assignment.id ? "..." : "Delete"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submission Dialog for Students */}
      <Dialog open={submissionDialogOpen} onOpenChange={setSubmissionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Assignment: {selectedAssignment?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAssignment?.description && (
              <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-sm font-medium mb-1">Instructions:</p>
                <p className="text-sm text-muted-foreground">{selectedAssignment.description}</p>
              </div>
            )}

            <div>
              <Label>Upload Your Work *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSubmissionFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Max file size: 10MB. Supported formats: PDF, JPG, PNG
              </p>
            </div>

            <div>
              <Label>Submission Notes (Optional)</Label>
              <Textarea
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Any additional comments for the teacher..."
                rows={3}
              />
            </div>

            <Button onClick={handleSubmitAssignment} disabled={!submissionFile || submitting} className="w-full">
              {submitting ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Assignment
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog for Teachers */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Grade (0-100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={reviewGrade}
                onChange={(e) => setReviewGrade(parseInt(e.target.value) || 0)}
              />
            </div>

            <div>
              <Label>Feedback</Label>
              <Textarea
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                placeholder="Provide feedback to the student..."
                rows={4}
              />
            </div>

            <Button onClick={handleReviewSubmission} className="w-full">
              Submit Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
