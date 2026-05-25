import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Settings, User, Building2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { getNavigationForRole } from '@/config/navigation';
import { ROLE_LABELS } from '@/types/roles';
import { TouchPress } from './ui/TouchPress';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const { activeOrgName } = useActiveOrg();

  if (!profile) return null;
  const groups = getNavigationForRole(profile.role);
  const initials = (profile.displayName || profile.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    await signOut();
    navigate('/login');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-sm p-0 bg-background border-r border-white/[0.08] flex flex-col"
      >
        {/* Header */}
        <div
          className="p-5 border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-accent/10"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-primary/30">
              <AvatarImage src={profile.avatarUrl} />
              <AvatarFallback className="bg-gradient-to-br from-primary/40 to-accent/40 text-primary-foreground font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold truncate">{profile.displayName || profile.email}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</div>
            </div>
          </div>
          {activeOrgName && (
            <TouchPress
              onClick={() => go('/select-organization')}
              className="mt-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-foreground/90"
            >
              <Building2 className="w-3 h-3" />
              <span className="truncate max-w-[180px]">{activeOrgName}</span>
            </TouchPress>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-2">
          {groups.map((g) => (
            <div key={g.label} className="px-3 py-2">
              <div className="px-2 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
                {g.label}
              </div>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = pathname === item.url;
                  const Icon = item.icon;
                  return (
                    <TouchPress
                      key={item.url}
                      onClick={() => go(item.url)}
                      className={cn(
                        'w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-left',
                        active
                          ? 'bg-gradient-to-r from-primary/20 to-accent/10 text-primary font-medium'
                          : 'text-foreground/85 hover:bg-white/[0.04]',
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </TouchPress>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="border-t border-white/[0.06] p-3 space-y-1"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
        >
          <TouchPress
            onClick={() => go('/profile')}
            className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-foreground/85 hover:bg-white/[0.04]"
          >
            <User className="w-4 h-4" />
            Profile
          </TouchPress>
          {profile.role === 'superadmin' && (
            <TouchPress
              onClick={() => go('/settings')}
              className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-foreground/85 hover:bg-white/[0.04]"
            >
              <Settings className="w-4 h-4" />
              Settings
            </TouchPress>
          )}
          <TouchPress
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </TouchPress>
        </div>
      </SheetContent>
    </Sheet>
  );
}