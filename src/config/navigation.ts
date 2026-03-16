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
  HeadphonesIcon,
  Monitor,
  Video,
  FileText,
  DollarSign,
  Bell,
  Ticket,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import type { AppRole } from '@/types/roles';

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: AppRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigationConfig: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
        roles: ['superadmin', 'admin', 'support', 'teacher', 'student', 'parent'],
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        title: 'Courses',
        url: '/courses',
        icon: BookOpen,
        roles: ['superadmin', 'admin', 'support', 'teacher', 'student'],
      },
      {
        title: 'Curriculum',
        url: '/curriculum',
        icon: Layers,
        roles: ['superadmin', 'admin'],
      },
      {
        title: 'Batches',
        url: '/batches',
        icon: Users,
        roles: ['superadmin', 'admin', 'support', 'teacher', 'student'],
      },
      {
        title: 'Schedule',
        url: '/schedule',
        icon: CalendarDays,
        roles: ['superadmin', 'admin', 'support', 'teacher', 'student', 'parent'],
      },
      {
        title: 'Attendance',
        url: '/attendance',
        icon: ClipboardCheck,
        roles: ['superadmin', 'admin', 'teacher'],
      },
      {
        title: 'Live Classes',
        url: '/live-classes',
        icon: Video,
        roles: ['superadmin', 'admin', 'teacher', 'student'],
      },
      {
        title: 'Materials',
        url: '/materials',
        icon: FileText,
        roles: ['superadmin', 'admin', 'teacher', 'student'],
      },
    ],
  },
  {
    label: 'CRM',
    items: [
      {
        title: 'Leads',
        url: '/leads',
        icon: UserPlus,
        roles: ['superadmin', 'admin', 'support'],
      },
      {
        title: 'Enrollments',
        url: '/enrollments',
        icon: GraduationCap,
        roles: ['superadmin', 'admin', 'support'],
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        title: 'Users',
        url: '/users',
        icon: Users,
        roles: ['superadmin', 'admin'],
      },
      {
        title: 'Students',
        url: '/students',
        icon: GraduationCap,
        roles: ['superadmin', 'admin', 'support', 'teacher', 'parent'],
      },
      {
        title: 'Payments',
        url: '/payments',
        icon: CreditCard,
        roles: ['superadmin', 'admin', 'support', 'parent'],
      },
      {
        title: 'Payroll',
        url: '/payroll',
        icon: DollarSign,
        roles: ['superadmin'],
      },
      {
        title: 'Subscriptions',
        url: '/subscriptions',
        icon: CreditCard,
        roles: ['superadmin'],
      },
      {
        title: 'Coupons',
        url: '/coupons',
        icon: Ticket,
        roles: ['superadmin'],
      },
    ],
  },
  {
    label: 'Tools',
    items: [
      {
        title: 'Font Architect',
        url: '/font-architect',
        icon: PenTool,
        roles: ['superadmin', 'admin'],
      },
      {
        title: 'Reports',
        url: '/reports',
        icon: BarChart3,
        roles: ['superadmin', 'admin'],
      },
      {
        title: 'Notifications',
        url: '/notifications',
        icon: Bell,
        roles: ['superadmin', 'admin', 'support'],
      },
      {
        title: 'Activity Logs',
        url: '/activity-logs',
        icon: Shield,
        roles: ['superadmin'],
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        title: 'Organizations',
        url: '/organizations',
        icon: Shield,
        roles: ['superadmin'],
      },
      {
        title: 'Roles & Permissions',
        url: '/roles',
        icon: Shield,
        roles: ['superadmin'],
      },
      {
        title: 'System Monitoring',
        url: '/monitoring',
        icon: Monitor,
        roles: ['superadmin'],
      },
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings,
        roles: ['superadmin', 'admin'],
      },
    ],
  },
];

export function getNavigationForRole(role: AppRole): NavGroup[] {
  return navigationConfig
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}
