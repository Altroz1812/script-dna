export type AppRole = 'superadmin' | 'admin' | 'teacher' | 'student' | 'parent';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

export const ROLE_HIERARCHY: AppRole[] = [
  'superadmin',
  'admin',
  'teacher',
  'student',
  'parent',
];
