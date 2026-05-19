import { LogOut, User, Settings, ChevronDown, Building2, Globe2, Repeat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { ROLE_LABELS } from '@/types/roles';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationsBell } from '@/components/layout/NotificationsBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { isSuperAdmin } = useRBAC();
  const { activeOrgId, activeOrgName, availableOrgs } = useActiveOrg();
  const showSwitcher = isSuperAdmin || availableOrgs.length > 1;

  const initials = profile?.displayName
    ? profile.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (profile?.email?.[0]?.toUpperCase() ?? 'U');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-14 flex items-center justify-between border-b border-white/[0.06] bg-background/60 backdrop-blur-xl px-4 sticky top-0 z-40 relative">
      {/* Gradient bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-primary/50 via-[hsl(var(--glow)/0.5)] to-gold/50" />

      <div className="flex items-center gap-2">
        <SidebarTrigger />
        {showSwitcher && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/select-organization')}
            className="ml-2 h-8 gap-2 bg-white/[0.03] border-white/[0.1] hover:border-gold/50 hover:shadow-[0_0_18px_-6px_hsl(var(--accent)/0.5)]"
            title="Switch organization"
          >
            {isSuperAdmin && activeOrgId === null ? (
              <Globe2 className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Building2 className="h-3.5 w-3.5 text-primary" />
            )}
            <span className="hidden sm:inline text-xs font-medium max-w-[160px] truncate">
              {activeOrgId === null
                ? 'Global view'
                : (activeOrgName || (availableOrgs.find(o => o.id === activeOrgId)?.name) || 'Select organization')}
            </span>
            <Badge variant="secondary" className="hidden md:inline-flex h-5 px-1.5 text-[10px]">
              <Repeat className="h-3 w-3 mr-1" /> Switch
            </Badge>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <NotificationsBell />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-9 px-2 hover:bg-white/[0.04] group">
            <Avatar className="h-7 w-7 ring-2 ring-primary/25 group-hover:ring-gold/60 transition-all duration-300">
              <AvatarImage src={profile?.avatarUrl} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-primary/40 to-gold/40 text-primary-foreground font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-medium leading-none">
                {profile?.displayName || profile?.email || 'User'}
              </span>
              <span className="text-[11px] text-muted-foreground leading-none mt-0.5">
                {profile ? ROLE_LABELS[profile.role] : ''}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 glass-panel">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{profile?.displayName || 'User'}</p>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          {isSuperAdmin && (
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
