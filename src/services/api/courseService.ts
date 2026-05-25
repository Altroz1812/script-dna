// src/services/api/courseService.ts

import { supabase } from "@/integrations/supabase/client";
import { adminQuery } from "@/services/api/adminService";

// ===== INTERFACES =====
export interface Course {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  grade_level: string | null;
  duration_days: number | null;
  total_hours: number | null;
  daily_hours: number | null;
  language: string | null;
  writing_style: string | null;
  includes_speed: boolean;
  fee: number | null;
  delivery_mode: string;
  center: string | null;
}

export interface Batch {
  id: string;
  course_id: string;
  name: string;
  max_students: number;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
  meeting_room?: string | null;
  meeting_link_expires_at?: string | null;
  organization_id?: string | null;
  teacher_name?: string | null;
  enrolled_count?: number;
  courses?: { name: string; delivery_mode?: string; duration_days?: number; daily_hours?: number; total_hours?: number };
}

export interface BatchStudent {
  id: string;
  batch_id: string;
  student_id: string;
  enrolled_at: string;
  profile?: { id?: string; user_id?: string; display_name: string | null; email: string | null };
}

export interface CreateCourseParams {
  name: string;
  description: string | null;
  created_by: string;
  grade_level?: string;
  duration_days?: number;
  total_hours?: number;
  daily_hours?: number;
  language?: string;
  writing_style?: string;
  includes_speed?: boolean;
  fee?: number;
  delivery_mode?: string;
  center?: string;
}

// ===== COURSE SERVICE =====
export const courseService = {
  async listCourses(): Promise<Course[]> {
    // Goes through admin-query so SuperAdmins/Admins see only the active org.
    // Students/teachers/parents fall back to direct RLS-scoped read.
    try {
      const data = await adminQuery("list_courses");
      return (data ?? []) as Course[];
    } catch {
      const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  },

  async createCourse(params: CreateCourseParams): Promise<Course> {
    return (await adminQuery("create_course", params)) as Course;
  },

  async updateCourse(id: string, updates: Partial<CreateCourseParams>): Promise<Course> {
    return (await adminQuery("update_course", { id, ...updates })) as Course;
  },

  async deleteCourse(id: string): Promise<void> {
    await adminQuery("delete_course", { id });
  },
};

// ===== BATCH SERVICE =====
export const batchService = {
  async listBatches(courseId?: string): Promise<Batch[]> {
    try {
      const data = await adminQuery("list_batches", courseId ? { course_id: courseId } : {});
      return (data ?? []) as Batch[];
    } catch {
      // Fallback for non-admin roles (teachers/students) – RLS does the scoping
      let q = supabase
        .from("batches")
        .select("*, courses(name, delivery_mode)")
        .order("created_at", { ascending: false });
      if (courseId) q = q.eq("course_id", courseId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }
  },

  async createBatch(organizationId: string, courseId: string, name: string, maxStudents: number = 25): Promise<Batch> {
    return (await adminQuery("create_batch", {
      course_id: courseId,
      name,
      max_students: maxStudents,
      organization_id: organizationId,
    })) as Batch;
  },

  async assignTeacher(batchId: string, teacherId: string | null): Promise<void> {
    await adminQuery("update_batch", { id: batchId, teacher_id: teacherId });
  },

  async updateBatch(id: string, name: string, maxStudents: number): Promise<void> {
    await adminQuery("update_batch", { id, name, max_students: maxStudents });
  },

  async deleteBatch(id: string): Promise<void> {
    await adminQuery("delete_batch", { id });
  },

  async getBatchDetail(id: string): Promise<any> {
    return await adminQuery("get_batch_detail", { id });
  },

  async getStudents(batchId: string): Promise<BatchStudent[]> {
    const data = await adminQuery("list_batch_students", { batch_id: batchId });
    // Normalize {profile} -> {profiles} so existing UI mapping continues to work
    return ((data ?? []) as any[]).map((row) => ({
      ...row,
      profiles: row.profile ?? row.profiles ?? null,
    })) as BatchStudent[];
  },

  async getStudentCount(batchId: string): Promise<number> {
    const c = await adminQuery("batch_student_count", { batch_id: batchId });
    return typeof c === "number" ? c : 0;
  },

  async addStudent(batchId: string, studentId: string): Promise<void> {
    await adminQuery("add_batch_student", { batch_id: batchId, student_id: studentId });
  },

  async removeStudent(batchId: string, studentId: string): Promise<void> {
    await adminQuery("remove_batch_student", { batch_id: batchId, student_id: studentId });
  },

  async listTeachers(opts?: { excludeAssigned?: boolean; batchId?: string }):
    Promise<{ user_id: string; display_name: string | null; email: string | null }[]> {
    const data = await adminQuery("list_teachers", {
      exclude_assigned: opts?.excludeAssigned ? true : undefined,
      batch_id: opts?.batchId,
    });
    return (data ?? []) as any[];
  },

  async listStudents(): Promise<{ id: string; user_id: string; display_name: string | null; email: string | null }[]> {
    const data = await adminQuery("list_all_students");
    return (data ?? []) as any[];
  },

  async checkTeacherConflicts(teacherId: string, batchId: string): Promise<ConflictInfo[]> {
    const data = await adminQuery("check_teacher_conflicts", { teacher_id: teacherId, batch_id: batchId });
    return (data ?? []) as ConflictInfo[];
  },

  async checkStudentConflicts(studentId: string, batchId: string): Promise<ConflictInfo[]> {
    const data = await adminQuery("check_student_conflicts", { student_id: studentId, batch_id: batchId });
    return (data ?? []) as ConflictInfo[];
  },

  async checkSlotConflicts(args: {
    teacher_id?: string | null;
    student_ids?: string[];
    date?: string | null;
    day_of_week: number;
    start_time: string;
    end_time: string;
    exclude_batch_id?: string | null;
  }): Promise<{ teacher_conflicts: ConflictInfo[]; student_conflicts: ConflictInfo[] }> {
    const data = await adminQuery("check_slot_conflicts", args);
    return (data ?? { teacher_conflicts: [], student_conflicts: [] }) as any;
  },
};

export type ConflictInfo = {
  date: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  other_batch_id: string;
  other_batch_name: string;
};

// ===== SCHEDULE SERVICE =====
export const scheduleService = {
  async bulkCreateSchedules(
    entries: Array<{
      batch_id: string;
      title: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      room: string | null;
      date: string;
    }>,
  ): Promise<void> {
    const { error } = await supabase.from("schedules").insert(entries);

    if (error) throw error;
  },

  async listSchedules(batchId?: string): Promise<any[]> {
    let query = supabase
      .from("schedules")
      .select("*, batches(name, courses(name))")
      .order("day_of_week")
      .order("start_time");

    if (batchId) {
      query = query.eq("batch_id", batchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createSchedule(params: any): Promise<any> {
    const { data, error } = await supabase.from("schedules").insert(params).select().single();

    if (error) throw error;
    return data;
  },

  async updateSchedule(id: string, updates: any): Promise<void> {
    const { error } = await supabase.from("schedules").update(updates).eq("id", id);

    if (error) throw error;
  },

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase.from("schedules").delete().eq("id", id);

    if (error) throw error;
  },
};
