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
      return await batchService.createBatch(selectedCourse, batchName.trim(), maxStudents);
    },

    onSuccess: async () => {
      toast.success("Batch created");

      setBatchName("");
      setSelectedCourse("");
      setMaxStudents(25);
      setOpen(false);

      await invalidate();
    },

    onError: (error: any) => {
      toast.error(getErrorMessage(error));
    },
  });

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

  return <div className="p-6">{/* YOUR EXISTING JSX UI REMAINS SAME */}</div>;
}
