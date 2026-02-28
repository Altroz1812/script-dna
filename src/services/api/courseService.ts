import { supabase } from '@/integrations/supabase/client';

export interface Course {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  course_id: string;
  name: string;
  max_students: number;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
  courses?: { name: string };
  teacher_profile?: { display_name: string | null; email: string | null } | null;
}

export interface BatchStudent {
  id: string;
  batch_id: string;
  student_id: string;
  enrolled_at: string;
  profile?: { display_name: string | null; email: string | null };
}

export const courseService = {
  async listCourses(): Promise<Course[]> {
    const { data, error } = await (supabase
      .from('courses' as any)
      .select('*')
      .order('created_at', { ascending: false }) as any);
    if (error) throw error;
    return data ?? [];
  },

  async createCourse(name: string, description: string | null, createdBy: string): Promise<Course> {
    const { data, error } = await (supabase
      .from('courses' as any)
      .insert({ name, description, created_by: createdBy })
      .select()
      .single() as any);
    if (error) throw error;
    return data;
  },

  async deleteCourse(id: string): Promise<void> {
    const { error } = await (supabase
      .from('courses' as any)
      .delete()
      .eq('id', id) as any);
    if (error) throw error;
  },
};

export const batchService = {
  async listBatches(courseId?: string): Promise<Batch[]> {
    let query = (supabase
      .from('batches' as any)
      .select('*, courses(name)') as any);
    if (courseId) query = query.eq('course_id', courseId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createBatch(courseId: string, name: string, maxStudents: number = 25): Promise<Batch> {
    const { data, error } = await (supabase
      .from('batches' as any)
      .insert({ course_id: courseId, name, max_students: maxStudents })
      .select()
      .single() as any);
    if (error) throw error;
    return data;
  },

  async assignTeacher(batchId: string, teacherId: string | null): Promise<void> {
    const { error } = await (supabase
      .from('batches' as any)
      .update({ teacher_id: teacherId })
      .eq('id', batchId) as any);
    if (error) throw error;
  },

  async deleteBatch(id: string): Promise<void> {
    const { error } = await (supabase
      .from('batches' as any)
      .delete()
      .eq('id', id) as any);
    if (error) throw error;
  },

  async getStudents(batchId: string): Promise<BatchStudent[]> {
    const { data, error } = await (supabase
      .from('batch_students' as any)
      .select('*, profiles!batch_students_student_id_fkey(display_name, email)')
      .eq('batch_id', batchId) as any);
    if (error) {
      // fallback without join
      const { data: d2, error: e2 } = await (supabase
        .from('batch_students' as any)
        .select('*')
        .eq('batch_id', batchId) as any);
      if (e2) throw e2;
      return d2 ?? [];
    }
    return data ?? [];
  },

  async getStudentCount(batchId: string): Promise<number> {
    const { count, error } = await (supabase
      .from('batch_students' as any)
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId) as any);
    if (error) throw error;
    return count ?? 0;
  },

  async addStudent(batchId: string, studentId: string): Promise<void> {
    const { error } = await (supabase
      .from('batch_students' as any)
      .insert({ batch_id: batchId, student_id: studentId }) as any);
    if (error) throw error;
  },

  async removeStudent(batchId: string, studentId: string): Promise<void> {
    const { error } = await (supabase
      .from('batch_students' as any)
      .delete()
      .eq('batch_id', batchId)
      .eq('student_id', studentId) as any);
    if (error) throw error;
  },

  async listTeachers(): Promise<{ user_id: string; display_name: string | null; email: string | null }[]> {
    const { data, error } = await (supabase
      .from('user_roles' as any)
      .select('user_id')
      .eq('role', 'teacher') as any);
    if (error) throw error;
    if (!data?.length) return [];
    const ids = data.map((r: any) => r.user_id);
    const { data: profiles, error: pErr } = await (supabase
      .from('profiles' as any)
      .select('user_id, display_name, email')
      .in('user_id', ids) as any);
    if (pErr) throw pErr;
    return profiles ?? [];
  },

  async listStudents(): Promise<{ user_id: string; display_name: string | null; email: string | null }[]> {
    const { data, error } = await (supabase
      .from('user_roles' as any)
      .select('user_id')
      .eq('role', 'student') as any);
    if (error) throw error;
    if (!data?.length) return [];
    const ids = data.map((r: any) => r.user_id);
    const { data: profiles, error: pErr } = await (supabase
      .from('profiles' as any)
      .select('user_id, display_name, email')
      .in('user_id', ids) as any);
    if (pErr) throw pErr;
    return profiles ?? [];
  },
};
