import { adminQuery } from './adminService';

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
  courses?: { name: string; duration_days?: number; daily_hours?: number; total_hours?: number; delivery_mode?: string };
  teacher_profile?: { display_name: string | null; email: string | null } | null;
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

export const courseService = {
  async listCourses(): Promise<Course[]> {
    return await adminQuery('list_courses');
  },

  async createCourse(params: CreateCourseParams): Promise<Course> {
    return await adminQuery('create_course', params);
  },

  async updateCourse(id: string, updates: Partial<CreateCourseParams>): Promise<void> {
    await adminQuery('update_course', { id, ...updates });
  },

  async deleteCourse(id: string): Promise<void> {
    await adminQuery('delete_course', { id });
  },
};

export const batchService = {
  async listBatches(courseId?: string): Promise<Batch[]> {
    return await adminQuery('list_batches', courseId ? { course_id: courseId } : {});
  },

  async createBatch(courseId: string, name: string, maxStudents: number = 25): Promise<Batch> {
    return await adminQuery('create_batch', { course_id: courseId, name, max_students: maxStudents });
  },

  async assignTeacher(batchId: string, teacherId: string | null): Promise<void> {
    await adminQuery('update_batch', { id: batchId, teacher_id: teacherId });
  },

  async updateBatch(id: string, name: string, maxStudents: number): Promise<void> {
    await adminQuery('update_batch', { id, name, max_students: maxStudents });
  },

  async deleteBatch(id: string): Promise<void> {
    await adminQuery('delete_batch', { id });
  },

  async getStudents(batchId: string): Promise<BatchStudent[]> {
    return await adminQuery('list_batch_students', { batch_id: batchId });
  },

  async getStudentCount(batchId: string): Promise<number> {
    return await adminQuery('batch_student_count', { batch_id: batchId });
  },

  async addStudent(batchId: string, studentId: string): Promise<void> {
    await adminQuery('add_batch_student', { batch_id: batchId, student_id: studentId });
  },

  async removeStudent(batchId: string, studentId: string): Promise<void> {
    await adminQuery('remove_batch_student', { batch_id: batchId, student_id: studentId });
  },

  async listTeachers(): Promise<{ user_id: string; display_name: string | null; email: string | null }[]> {
    return await adminQuery('list_teachers');
  },

  async listStudents(): Promise<{ user_id: string; display_name: string | null; email: string | null }[]> {
    return await adminQuery('list_all_students');
  },
};

export const scheduleService = {
  async bulkCreateSchedules(entries: Array<{
    batch_id: string;
    title: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room: string | null;
    date: string;
  }>): Promise<void> {
    await adminQuery('bulk_create_schedules', { entries });
  },
};
