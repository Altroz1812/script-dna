import { useState } from 'react';
import { LogOut, Save, KeyRound, Mail, Shield, Building2, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS } from '@/types/roles';
import { MobilePage } from '@/components/mobile/ui/MobilePage';
import { TouchPress } from '@/components/mobile/ui/TouchPress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function MobileProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth() as any;
  const { role } = useRBAC();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [changing, setChanging] = useState(false);

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.[0]?.toUpperCase() ?? 'U');

  const save = async () => {
    if (!profile) return;
    if (!displayName.trim()) return toast.error('Display name required');
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim(), avatar_url: avatarUrl.trim() || null })
        .eq('user_id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changePwd = async () => {
    if (!oldPwd || !newPwd) return toast.error('Fill both passwords');
    if (newPwd.length < 8) return toast.error('Password must be 8+ chars');
    setChanging(true);
    try {
      const res = await supabase.functions.invoke('change-password', {
        body: { oldPassword: oldPwd, newPassword: newPwd },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('Password updated');
      setOldPwd(''); setNewPwd('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChanging(false);
    }
  };

  return (
    <MobilePage>
      <div className="flex flex-col items-center pt-2 pb-4">
        <Avatar className="h-24 w-24 ring-4 ring-primary/20">
          <AvatarImage src={avatarUrl || profile?.avatarUrl} />
          <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-accent text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="mt-3 text-lg font-semibold font-display">{profile?.displayName || 'User'}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <Mail className="w-3 h-3" />{profile?.email}
        </div>
        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 text-xs font-medium">
          <Shield className="w-3 h-3" />{ROLE_LABELS[role || 'student']}
        </div>
      </div>

      <section className="rounded-2xl p-4 bg-card border border-white/[0.06] space-y-3">
        <h2 className="text-sm font-semibold">Edit Profile</h2>
        <div className="space-y-2">
          <Label className="text-xs">Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Avatar URL</Label>
          <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="h-11" placeholder="https://..." />
        </div>
        <Button onClick={save} disabled={saving} className="w-full h-11">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </section>

      <section className="rounded-2xl p-4 bg-card border border-white/[0.06] space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="w-4 h-4" />Change Password</h2>
        <div className="space-y-2">
          <Label className="text-xs">Current password</Label>
          <div className="relative">
            <Input type={showPwd ? 'text' : 'password'} value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} className="h-11 pr-10" />
            <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">New password</Label>
          <Input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="h-11" />
        </div>
        <Button onClick={changePwd} disabled={changing} variant="outline" className="w-full h-11">
          {changing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Update Password
        </Button>
      </section>

      <TouchPress
        onClick={async () => { try { await signOut?.(); } catch (e: any) { toast.error(e.message); } }}
        className="w-full h-12 rounded-xl bg-destructive/15 text-destructive font-semibold flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </TouchPress>
    </MobilePage>
  );
}