import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Video, User, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TouchPress } from './ui/TouchPress';
import { cn } from '@/lib/utils';

interface Tab {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
  match: (p: string) => boolean;
}

export function MobileBottomTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = profile?.role;

  const coursesPath = role === 'teacher' || role === 'admin' || role === 'superadmin' ? '/batches' : '/courses';

  const tabs: Tab[] = [
    { key: 'home', label: 'Home', icon: Home, path: '/dashboard', match: (p) => p === '/dashboard' || p === '/' },
    {
      key: 'courses',
      label: role === 'teacher' || role === 'admin' || role === 'superadmin' ? 'Batches' : 'Courses',
      icon: BookOpen,
      path: coursesPath,
      match: (p) => p.startsWith('/courses') || p.startsWith('/batches'),
    },
    { key: 'classes', label: 'Classes', icon: Video, path: '/live-classes', match: (p) => p.startsWith('/live-classes') },
    { key: 'profile', label: 'Profile', icon: User, path: '/profile', match: (p) => p.startsWith('/profile') },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-background/85 backdrop-blur-xl border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="h-16 grid grid-cols-4">
        {tabs.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <TouchPress
              key={t.key}
              onClick={() => navigate(t.path)}
              aria-label={t.label}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 h-full',
              )}
            >
              {active && (
                <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-gradient-to-r from-primary to-accent" />
              )}
              <span
                className={cn(
                  'flex items-center justify-center h-7 w-12 rounded-full transition-colors',
                  active
                    ? 'bg-gradient-to-br from-primary/25 to-accent/25 text-primary'
                    : 'text-muted-foreground',
                )}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium tracking-tight',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {t.label}
              </span>
            </TouchPress>
          );
        })}
      </div>
    </nav>
  );
}