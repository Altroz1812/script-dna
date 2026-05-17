import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useRBAC } from "@/hooks/useRBAC";

import { courseService, batchService, type Course, type Batch } from "@/services/api/courseService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";

import { Plus, Trash2, Users, UserPlus, UserMinus, Layers, Wifi, Building2, Pencil } from "lucide-react";

import { CardGridSkeleton } from "@/components/ui/loading-skeletons";

type Teacher = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type Student = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type EnrolledStudent = {
  id: string;
  student_id: string;
  display_name?: string | null;
  email?: string | null;
};

const getErrorMessage = (error: any) => {
  console.log("API ERROR =>", error);

  return error?.message || error?.error || error?.details || "Something went wrong";
};

export default function BatchesPage() {
  const { profile } = useAuth();

  // Add this debug log
console.log("Profile object keys:", Object.keys(profile || {}));
console.log("organizationId value:", profile?.organizationId);
console.log("organization_id value:", (profile as any)?.organization_id);
  
  const { profile } = useAuth();
  const { isAdmin } = useRBAC();

  const queryClient = useQueryClient();

  // create batch
  const [open, setOpen] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [maxStudents, setMaxStudents] = useState(25);

  // edit batch
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [editName, setEditName] = useState("");
  const [editMaxStudents, setEditMaxStudents] = useState(25);

  // teacher dialog
  const [teacherDialogBatch, setTeacherDialogBatch] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // students dialog
  const [studentDialogBatch, setStudentDialogBatch] = useState<Batch | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);

  const [selectedStudent, setSelectedStudent] = useState("");
  const [studentCount, setStudentCount] = useState(0);

  // ---------------- QUERIES ----------------

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: courseService.listCourses,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: batches = [],
    isLoading,
    refetch,
  } = useQuery<Batch[]>({
    queryKey: ["batches"],
    queryFn: batchService.listBatches,
    staleTime: 1000 * 60 * 5,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["batches"] }),
      queryClient.invalidateQueries({ queryKey: ["admin_stats"] }),
    ]);
  };

  // ---------------- CREATE ----------------

const createMutation = useMutation({
  mutationFn: async () => {
    if (!profile?.organizationId) {  // ← USE camelCase
      throw new Error("Organization ID missing");
    }

    return await batchService.createBatch(profile.organizationId, ...); // ← USE camelCase
  },
  // ---------------- DELETE ----------------

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await batchService.deleteBatch(id);
    },

    onSuccess: async () => {
      toast.success("Batch deleted");
      await invalidate();
    },

    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  // ---------------- EDIT ----------------

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editBatch) throw new Error("Batch not found");

      return await batchService.updateBatch(editBatch.id, editName.trim(), editMaxStudents);
    },

    onSuccess: async () => {
      toast.success("Batch updated");

      setEditBatch(null);

      await invalidate();
    },

    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  // ---------------- ASSIGN TEACHER ----------------

  const assignTeacherMutation = useMutation({
    mutationFn: async () => {
      if (!teacherDialogBatch) {
        throw new Error("Batch not selected");
      }

      return await batchService.assignTeacher(
        teacherDialogBatch,
        selectedTeacher === "__none__" ? null : selectedTeacher,
      );
    },

    onSuccess: async () => {
      toast.success("Teacher assigned");

      setTeacherDialogBatch(null);
      setSelectedTeacher("");

      await invalidate();
    },

    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

  // ---------------- HANDLERS ----------------

  const handleCreateBatch = () => {
    if (!batchName.trim()) {
      toast.error("Batch name required");
      return;
    }

    if (!selectedCourse) {
      toast.error("Select course");
      return;
    }

    if (maxStudents < 1 || maxStudents > 100) {
      toast.error("Max students should be 1-100");
      return;
    }

    createMutation.mutate();
  };

  const handleEditBatch = () => {
    if (!editName.trim()) {
      toast.error("Batch name required");
      return;
    }

    if (editMaxStudents < 1 || editMaxStudents > 100) {
      toast.error("Max students should be 1-100");
      return;
    }

    editMutation.mutate();
  };

  const openEditDialog = (batch: Batch) => {
    setEditBatch(batch);
    setEditName(batch.name);
    setEditMaxStudents(batch.max_students);
  };

  // ---------------- TEACHERS ----------------

  const openTeacherDialog = async (batchId: string) => {
    try {
      setTeacherDialogBatch(batchId);

      const data = await batchService.listTeachers();

      setTeachers(data || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  };

  // ---------------- STUDENTS ----------------

  const openStudentDialog = useCallback(async (batch: Batch) => {
    try {
      setStudentDialogBatch(batch);

      const [studs, enrolled, count] = await Promise.all([
        batchService.listStudents(),
        batchService.getStudents(batch.id),
        batchService.getStudentCount(batch.id),
      ]);

      setStudents(studs || []);

      setEnrolledStudents(
        (enrolled || []).map((e: any) => ({
          id: e.id,
          student_id: e.student_id,
          display_name: e.profiles?.display_name || null,
          email: e.profiles?.email || null,
        })),
      );

      setStudentCount(count || 0);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  }, []);

  const handleAddStudent = async () => {
    try {
      if (!studentDialogBatch || !selectedStudent) return;

      if (studentCount >= studentDialogBatch.max_students) {
        toast.error(`Maximum ${studentDialogBatch.max_students} students reached`);
        return;
      }

      await batchService.addStudent(studentDialogBatch.id, selectedStudent);

      toast.success("Student added");

      setSelectedStudent("");

      await openStudentDialog(studentDialogBatch);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      if (!studentDialogBatch) return;

      await batchService.removeStudent(studentDialogBatch.id, studentId);

      toast.success("Student removed");

      await openStudentDialog(studentDialogBatch);
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    }
  };

  // ---------------- LOADING ----------------

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Batches</h1>

          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>

        <CardGridSkeleton count={6} />
      </div>
    );
  }

  const enrolledIds = new Set(enrolledStudents.map((e) => e.student_id));

  const availableStudents = students.filter((s) => !enrolledIds.has(s.user_id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Batches</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "Manage batches, assign teachers & students" : "Your assigned batches"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Batch</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Course</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Batch Name</Label>
                  <Input
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Batch A - Morning"
                  />
                </div>
                <div>
                  <Label>Max Students (1-100)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={maxStudents}
                    onChange={(e) => setMaxStudents(Number(e.target.value))}
                  />
                </div>
                <Button onClick={handleCreateBatch} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Layers className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No batches yet.{isAdmin ? " Create one to get started." : ""}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <Card key={b.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{b.name}</CardTitle>
                    <CardDescription>{(b as any).courses?.name ?? "Unknown course"}</CardDescription>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(b)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <Badge variant="secondary">Max {b.max_students}</Badge>
                  {(b as any).courses?.delivery_mode === "offline" ? (
                    <Badge variant="outline" className="gap-1">
                      <Building2 className="h-3 w-3" /> Offline
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Wifi className="h-3 w-3" /> Online
                    </Badge>
                  )}
                  <span className="text-muted-foreground">Teacher: {b.teacher_id ? "Assigned" : "None"}</span>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openTeacherDialog(b.id)}>
                      <UserPlus className="mr-1 h-3 w-3" /> Teacher
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openStudentDialog(b)}>
                      <Users className="mr-1 h-3 w-3" /> Students
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Batch Dialog */}
      <Dialog
        open={!!editBatch}
        onOpenChange={(v) => {
          if (!v) setEditBatch(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Batch Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label>Max Students (1-100)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={editMaxStudents}
                onChange={(e) => setEditMaxStudents(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleEditBatch} disabled={editMutation.isPending} className="w-full">
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Teacher Dialog */}
      <Dialog
        open={!!teacherDialogBatch}
        onOpenChange={(v) => {
          if (!v) setTeacherDialogBatch(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger>
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No teacher</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.user_id} value={t.user_id}>
                    {t.display_name || t.email || t.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => assignTeacherMutation.mutate()}
              disabled={assignTeacherMutation.isPending}
              className="w-full"
            >
              {assignTeacherMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog
        open={!!studentDialogBatch}
        onOpenChange={(v) => {
          if (!v) setStudentDialogBatch(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Manage Students
              <Badge variant="outline" className="ml-2">
                {studentCount}/{studentDialogBatch?.max_students ?? 25}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select student to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.display_name || s.email || s.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddStudent}
                disabled={!selectedStudent || studentCount >= (studentDialogBatch?.max_students ?? 25)}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {enrolledStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No students enrolled</p>
              ) : (
                enrolledStudents.map((e) => (
                  <div key={e.student_id} className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">{e.display_name || e.email || e.student_id}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveStudent(e.student_id)}>
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
