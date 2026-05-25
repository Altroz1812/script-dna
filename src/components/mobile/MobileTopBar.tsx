import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu } from 'lucide-react';
import { TouchPress } from './ui/TouchPress';
import { NotificationsBell } from '@/components/layout/NotificationsBell';

const TITLES: Record<string, string> = {
  '/dashboard': 'Home',
  '/courses': 'Courses',
  '/batches': 'Batches',
  '/live-classes': 'Classes',
  '/profile': 'Profile',
  '/schedule': 'Schedule',
  '/attendance': 'Attendance',
  '/materials': 'Materials',
  '/practice': 'Practice',
  '/submissions': 'Submissions',
  '/leads': 'Leads',
  '/enrollments': 'Enrollments',
  '/users': 'Users',
  '/students': 'Students',
  '/payments': 'Payments',
  '/payroll': 'Payroll',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
  '/my-progress': 'My Progress',
  '/my-children': 'My Children',
  '/child-progress': 'Child Progress',
  '/my-orders': 'My Orders',
  '/curriculum': 'Curriculum',
  '/coupons': 'Coupons',
  '/subscriptions': 'Subscriptions',
  '/activity-logs': 'Activity',
  '/organizations': 'Organizations',
  '/roles': 'Roles',
  '/monitoring': 'Monitoring',
};

const TAB_ROUTES = new Set(['/dashboard', '/courses', '/batches', '/live-classes', '/profile']);

interface Props {
  onOpenMenu: () => void;
}

export function MobileTopBar({ onOpenMenu }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = TITLES[pathname] ?? 'AuraPen';
  const showBack = !TAB_ROUTES.has(pathname);

  return (
    <header
      className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-white/[0.06]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="h-14 px-2 flex items-center justify-between">
        {showBack ? (
          <TouchPress
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="h-11 w-11 rounded-full flex items-center justify-center text-foreground"
          >
            <ChevronLeft className="w-6 h-6" />
          </TouchPress>
        ) : (
          <TouchPress
            onClick={onOpenMenu}
            aria-label="Menu"
            className="h-11 w-11 rounded-full flex items-center justify-center text-foreground"
          >
            <Menu className="w-5 h-5" />
          </TouchPress>
        )}
        <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold font-display tracking-tight truncate max-w-[55%]">
          {title}
        </h1>
        <div className="flex items-center">
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}