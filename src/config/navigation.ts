import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  PenTool,
  UserPlus,
  Monitor,
  Video,
  FileText,
  DollarSign,
  Bell,
  Ticket,
  Layers,
  NotebookPen,
  ShoppingBag,
  FileCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/types/roles";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: AppRole[];
  globalOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigationConfig: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        roles: ["superadmin", "admin", "support", "teacher", "student", "parent"],
      },
    ],
  },
  {
    label: "Academics",
    items: [
      {
        title: "Courses",
        url: "/courses",
        icon: BookOpen,
        roles: ["superadmin", "admin", "support", "teacher", "student"],
      },

      {
        title: "Courses",
        url: "/courses",
        icon: BookOpen,
        roles: ["parent"],
      },

      { title: "Curriculum", url: "/curriculum", icon: Layers, roles: ["superadmin", "admin"] },
      {
        title: "Batches",
        url: "/batches",
        icon: Users,
        roles: ["superadmin", "admin", "support", "teacher", "student"],
      },
      { title: "Schedule", url: "/schedule", icon: CalendarDays, roles: ["superadmin", "admin"] },
      {
        title: "Live Classes",
        url: "/live-classes",
        icon: Video,
        roles: ["superadmin", "admin", "teacher", "student"],
      },
      {
        title: "Attendance",
        url: "/attendance",
        icon: ClipboardCheck,
        roles: ["superadmin", "admin", "teacher", "parent"],
      },
      { title: "Materials", url: "/materials", icon: FileText, roles: ["superadmin", "admin"] },
      { title: "Practice", url: "/practice", icon: NotebookPen, roles: ["superadmin", "admin", "teacher", "student"] },
      {
        title: "Practice Canvas",
        url: "/practice-canvas",
        icon: PenTool,
        roles: ["student", "teacher", "superadmin", "admin"],
      },
      {
        title: "Submissions",
        url: "/submissions",
        icon: FileCheck,
        roles: ["superadmin", "admin", "teacher", "student"],
      },
    ],
  },
  {
    label: "CRM",
    items: [
      { title: "Leads", url: "/leads", icon: UserPlus, roles: ["superadmin", "admin", "support"] },
      { title: "Enrollments", url: "/enrollments", icon: GraduationCap, roles: ["superadmin", "admin", "support"] },
    ],
  },
  {
    label: "Family",
    items: [
      { title: "My Children", url: "/my-children", icon: Users, roles: ["parent"] },
      { title: "Child Progress", url: "/child-progress", icon: TrendingUp, roles: ["parent"] },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Organizations", url: "/organizations", icon: Shield, roles: ["superadmin"], globalOnly: true },
      { title: "Users", url: "/users", icon: Users, roles: ["superadmin", "admin"] },
      { title: "Roles & Permissions", url: "/roles", icon: Shield, roles: ["superadmin"], globalOnly: true },
      {
        title: "Certificates",
        url: "/certificates",
        icon: FileCheck,
        roles: ["superadmin", "admin"],
      },
      {
        title: "Students",
        url: "/students",
        icon: GraduationCap,
        roles: ["superadmin", "admin", "support", "teacher"],
      },
      { title: "Payments", url: "/payments", icon: CreditCard, roles: ["superadmin", "admin", "support", "parent"] },
      { title: "Payroll", url: "/payroll", icon: DollarSign, roles: ["superadmin"] },
      { title: "Subscriptions", url: "/subscriptions", icon: CreditCard, roles: ["superadmin"] },
      { title: "Coupons", url: "/coupons", icon: Ticket, roles: ["superadmin"], globalOnly: true },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "My Progress", url: "/my-progress", icon: TrendingUp, roles: ["student"] },
      { title: "My Orders", url: "/my-orders", icon: ShoppingBag, roles: ["student", "parent"] },
      { title: "Font Architect", url: "/font-architect", icon: PenTool, roles: ["superadmin"], globalOnly: true },
      { title: "Reports", url: "/reports", icon: BarChart3, roles: ["superadmin", "admin", "teacher"] },
      { title: "Notifications", url: "/notifications", icon: Bell, roles: ["superadmin", "admin", "support"] },
      { title: "Activity Logs", url: "/activity-logs", icon: Shield, roles: ["superadmin"] },
    ],
  },
  {
    label: "System",
    items: [
      { title: "System Monitoring", url: "/monitoring", icon: Monitor, roles: ["superadmin"], globalOnly: true },
      { title: "Settings", url: "/settings", icon: Settings, roles: ["superadmin"], globalOnly: true },
    ],
  },
];

// export function getNavigationForRole(role: AppRole): NavGroup[] {
//   return navigationConfig
//     .map((group) => ({
//       ...group,
//       items: group.items.filter((item) => item.roles.includes(role)),
//     }))
//     .filter((group) => group.items.length > 0);
// }

export function getNavigationForRole(
  role: AppRole,
  isGlobalView: boolean = false, // ← New parameter
): NavGroup[] {
  return navigationConfig
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const hasRole = item.roles.includes(role);

        // Handle globalOnly items
        if (item.globalOnly) {
          return hasRole && isGlobalView;
        }

        return hasRole;
      }),
    }))
    .filter((group) => group.items.length > 0);
}
