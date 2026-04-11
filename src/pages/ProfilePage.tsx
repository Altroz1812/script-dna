import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Shield, Building2, Save, Loader2, Camera, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { ROLE_LABELS } from '@/types/roles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { checkPasswordStrength } from '@/lib/security';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { role, isAdmin, isSuperAdmin } = useRBAC();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? '');
  const [saving, setSaving] = useState(false);

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.[0]?.toUpperCase() ?? 'U');

  const handleSave = async () => {
    if (!profile) return;
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('user_id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    const strength = checkPasswordStrength(newPassword);
    if (strength.score < 2) {
      toast.error('Password is too weak. Please use a stronger password.');
      return;
    }
    if (oldPassword === newPassword) {
      toast.error('New password must be different from old password');
      return;
    }

    setChangingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('change-password', {
        body: { oldPassword, newPassword },
      });

      if (res.error) throw new Error(res.error.message || 'Failed to change password');
      if (res.data?.error) throw new Error(res.data.error);

      toast.success('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account details</p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/30">
              <AvatarImage src={profile.avatarUrl} />
              <AvatarFallback className="text-lg bg-gradient-to-br from-primary/30 to-coral/30 text-primary-foreground font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground truncate">{profile.displayName}</h2>
              <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
              <Badge variant="secondary" className="mt-1.5">
                <Shield className="h-3 w-3 mr-1" />
                {ROLE_LABELS[profile.role]}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Edit Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
            </Label>
            <Input id="email" value={profile.email} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName" className="text-sm">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avatarUrl" className="text-sm flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-muted-foreground" /> Avatar URL
            </Label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
            <p className="text-xs text-muted-foreground">Paste a link to your profile picture</p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="oldPassword" className="text-sm">Current Password</Label>
            <div className="relative">
              <Input
                id="oldPassword"
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowOld(!showOld)}
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword" className="text-sm">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            If you forgot your current password, contact your administrator to reset it.
          </p>

          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !oldPassword || !newPassword || !confirmPassword}
            className="w-full gap-2"
          >
            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {changingPassword ? 'Changing…' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="outline">{ROLE_LABELS[profile.role]}</Badge>
          </div>
          {profile.organizationId && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Organization
              </span>
              <span className="text-sm font-medium">Assigned</span>
            </div>
          )}
          <Separator className="bg-white/[0.06]" />
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? 'Contact Super Admin to change your role or organization assignment.'
              : 'Contact your administrator to update role or organization.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
