export type AppRole = "superadmin" | "admin" | "support" | "teacher" | "student" | "parent";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  organizationId?: string; // Make sure this exists
  role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  support: "Support",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

export const ROLE_HIERARCHY: AppRole[] = ["superadmin", "admin", "support", "teacher", "student", "parent"];
