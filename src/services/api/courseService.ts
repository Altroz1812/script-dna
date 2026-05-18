// src/services/api/courseService.ts

import { supabase } from "@/integrations/supabase/client";

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
  courses?: { name: string; delivery_mode?: string; duration_days?: number; daily_hours?: number; total_hours?: number };
}

export interface BatchStudent {
  id: string;
  batch_id: string;
  student_id: string;
  enrolled_at: string;
  profile?: { display_name: string | null; email: string | null };
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
    const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createCourse(params: CreateCourseParams): Promise<Course> {
    const { data, error } = await supabase
      .from("courses")
      .insert({
        name: params.name,
        description: params.description,
        created_by: params.created_by,
        grade_level: params.grade_level,
        duration_days: params.duration_days,
        total_hours: params.total_hours,
        daily_hours: params.daily_hours,
        language: params.language,
        writing_style: params.writing_style,
        includes_speed: params.includes_speed || false,
        fee: params.fee || 0,
        delivery_mode: params.delivery_mode || "online",
        center: params.center,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCourse(id: string, updates: Partial<CreateCourseParams>): Promise<Course> {
    const { data, error } = await supabase.from("courses").update(updates).eq("id", id).select().single();

    if (error) throw error;
    return data;
  },

  async deleteCourse(id: string): Promise<void> {
    const { error } = await supabase.from("courses").delete().eq("id", id);

    if (error) throw error;
  },
};

// ===== BATCH SERVICE =====
export const batchService = {
  async listBatches(courseId?: string): Promise<Batch[]> {
    let query = supabase
      .from("batches")
      .select("*, courses(name, delivery_mode)")
      .order("created_at", { ascending: false });

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createBatch(organizationId: string, courseId: string, name: string, maxStudents: number = 25): Promise<Batch> {
    const { data, error } = await supabase
      .from("batches")
      .insert({
        course_id: courseId,
        name: name,
        max_students: maxStudents,
        organization_id: organizationId,
      })
      .select("*, courses(name, delivery_mode)")
      .single();

    if (error) throw error;
    return data;
  },

  async assignTeacher(batchId: string, teacherId: string | null): Promise<void> {
    const { error } = await supabase.from("batches").update({ teacher_id: teacherId }).eq("id", batchId);

    if (error) throw error;
  },

  async updateBatch(id: string, name: string, maxStudents: number): Promise<void> {
    const { error } = await supabase.from("batches").update({ name, max_students: maxStudents }).eq("id", id);

    if (error) throw error;
  },

  async deleteBatch(id: string): Promise<void> {
    await supabase.from("batch_students").delete().eq("batch_id", id);
    const { error } = await supabase.from("batches").delete().eq("id", id);
    if (error) throw error;
  },

  async getStudents(batchId: string): Promise<BatchStudent[]> {
    const { data, error } = await supabase
      .from("batch_students")
      .select("*, profiles(display_name, email)")
      .eq("batch_id", batchId);

    if (error) throw error;
    return data || [];
  },

  async getStudentCount(batchId: string): Promise<number> {
    const { count, error } = await supabase
      .from("batch_students")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId);

    if (error) throw error;
    return count || 0;
  },

  async addStudent(batchId: string, studentId: string): Promise<void> {
    const { error } = await supabase.from("batch_students").insert({ batch_id: batchId, student_id: studentId });

    if (error) throw error;
  },

  async removeStudent(batchId: string, studentId: string): Promise<void> {
    const { error } = await supabase
      .from("batch_students")
      .delete()
      .eq("batch_id", batchId)
      .eq("student_id", studentId);

    if (error) throw error;
  },

  async listTeachers(): Promise<{ user_id: string; display_name: string | null; email: string | null }[]> {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");

    if (!roles?.length) return [];

    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", ids);

    return profiles || [];
  },

  async listStudents(): Promise<{ user_id: string; display_name: string | null; email: string | null }[]> {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");

    if (!roles?.length) return [];

    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", ids);

    return profiles || [];
  },
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
