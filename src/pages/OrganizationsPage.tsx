import { useEffect, useState, useRef } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, UserPlus, UserMinus, Building2, Palette, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input as ColorInput } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [memberDialog, setMemberDialog] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('');

  // Branding dialog
  const [brandingOrg, setBrandingOrg] = useState<any>(null);
  const [brandName, setBrandName] = useState('');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#6366f1');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoUploadedAt, setLogoUploadedAt] = useState<number | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const formatBytes = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return; }
    if (!brandingOrg) return;
    const toastId = `logo-upload-${brandingOrg.id}`;
    setLogoUploading(true);
    setLogoUploadError(null);
    toast.loading('Uploading logo to storage…', { id: toastId });
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `${brandingOrg.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('org-logos').upload(path, file, {
        cacheControl: '3600', upsert: true, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('Could not resolve public URL');
      // Verify the file is actually reachable (catches bucket-not-public misconfig)
      try {
        const head = await fetch(pub.publicUrl, { method: 'HEAD', cache: 'no-store' });
        if (!head.ok) throw new Error(`Storage returned HTTP ${head.status}`);
      } catch (verifyErr: any) {
        throw new Error(`Uploaded but not reachable: ${verifyErr?.message || 'unknown error'}`);
      }
      setBrandLogoUrl(pub.publicUrl);
      setLogoUploadedAt(Date.now());
      toast.success('Logo uploaded to storage', {
        id: toastId,
        description: `${formatBytes(file.size)} · org-logos/${path} — click Save Branding to apply.`,
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
    } catch (e: any) {
      const msg = e?.message || 'Upload failed';
      setLogoUploadError(msg);
      toast.error('Logo upload failed', { id: toastId, description: msg, icon: <AlertCircle className="h-4 w-4" /> });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSaveBranding = async () => {
    if (!brandingOrg) return;
    setSavingBranding(true);
    const submittedLogo = brandLogoUrl || null;
    try {
      await adminQuery('update_org_branding', {
        id: brandingOrg.id,
        branding: { display_name: brandName || null, logo_url: submittedLogo, primary_color: brandPrimaryColor },
      });
      // Verify persistence by reloading orgs and checking the logo_url
      const fresh: any[] = await adminQuery('list_organizations');
      const updated = fresh.find((o: any) => o.id === brandingOrg.id);
      const savedLogo = updated?.logo_url || updated?.branding?.logo_url || null;
      setOrgs(fresh);
      if ((submittedLogo || null) !== (savedLogo || null)) {
        toast.error('Branding partially saved', {
          description: `Logo URL did not persist (sent ${submittedLogo ? 'a URL' : 'empty'}, stored ${savedLogo ? 'different value' : 'empty'}). Please try again.`,
          icon: <AlertCircle className="h-4 w-4" />,
        });
        return;
      }
      toast.success('Branding saved', {
        description: submittedLogo ? 'Logo is now live on the organization card.' : 'Branding updated successfully.',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      setBrandingOrg(null);
      setLogoUploadError(null);
      setLogoUploadedAt(null);
    } catch (e: any) {
      toast.error('Failed to save branding', { description: e?.message || 'Unknown error' });
    } finally {
      setSavingBranding(false);
    }
  };

  const load = () => { setLoading(true); adminQuery('list_organizations').then(setOrgs).catch(e => toast.error(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) { toast.error('Name and slug required'); return; }
    try { await adminQuery('create_organization', { name: name.trim(), slug: slug.trim() }); toast.success('Organization created'); setOpen(false); setName(''); setSlug(''); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this organization?')) return;
    try { await adminQuery('delete_organization', { id }); toast.success('Deleted'); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await adminQuery('toggle_org_active', { id, is_active: !currentActive });
      toast.success(currentActive ? 'Organization disabled' : 'Organization enabled');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openMembers = async (org: any) => {
    setMemberDialog(org);
    const [m, u] = await Promise.all([adminQuery('list_org_members', { organization_id: org.id }), adminQuery('list_users')]);
    setMembers(m); setAllUsers(u);
  };

  const addMember = async () => {
    if (!selectedUser || !memberDialog) return;
    try { await adminQuery('add_org_member', { organization_id: memberDialog.id, user_id: selectedUser }); toast.success('Member added'); setSelectedUser(''); openMembers(memberDialog); load(); } catch (e: any) { toast.error(e.message); }
  };

  const removeMember = async (userId: string) => {
    if (!memberDialog) return;
    try { await adminQuery('remove_org_member', { organization_id: memberDialog.id, user_id: userId }); toast.success('Removed'); openMembers(memberDialog); load(); } catch (e: any) { toast.error(e.message); }
  };

  const memberIds = new Set(members.map(m => m.user_id));
  const availableUsers = allUsers.filter(u => !memberIds.has(u.user_id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Org</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>Slug</Label><Input value={slug} onChange={e => setSlug(e.target.value)} /></div>
              <Button onClick={handleCreate} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : orgs.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground"><Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" /><p>No organizations yet</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map(o => (
            <Card key={o.id} className={!o.is_active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 min-w-0">
                    <OrgLogo
                      src={o.logo_url || o.branding?.logo_url}
                      name={o.name}
                      tint={o.branding?.primary_color}
                      size="card"
                    />
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2">
                        <span className="truncate">{o.name}</span>
                        {!o.is_active && <Badge variant="destructive" className="text-xs">Disabled</Badge>}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 truncate">/{o.slug}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{o.member_count} members</Badge>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => {
                      setBrandingOrg(o);
                      const b = o.branding || {};
                      setBrandName(b.display_name || ''); setBrandPrimaryColor(b.primary_color || '#6366f1'); setBrandLogoUrl(b.logo_url || '');
                    }}><Palette className="mr-1 h-3 w-3" />Brand</Button>
                    <Button variant="outline" size="sm" onClick={() => openMembers(o)}><UserPlus className="mr-1 h-3 w-3" />Manage</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Active</span>
                  <Switch checked={o.is_active !== false} onCheckedChange={() => handleToggleActive(o.id, o.is_active !== false)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!memberDialog} onOpenChange={v => { if (!v) setMemberDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Members: {memberDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Add member..." /></SelectTrigger>
                <SelectContent>{availableUsers.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.display_name || u.email || u.user_id}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={addMember} disabled={!selectedUser}><UserPlus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {members.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No members</p> :
                members.map(m => (
                  <div key={m.user_id} className="flex items-center justify-between border rounded-md p-2">
                    <span className="text-sm">{m.profile?.display_name || m.profile?.email || m.user_id}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeMember(m.user_id)}><UserMinus className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))
              }
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Branding Dialog */}
      <Dialog open={!!brandingOrg} onOpenChange={v => { if (!v) { setBrandingOrg(null); setLogoUploadError(null); setLogoUploadedAt(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>White-Label Branding: {brandingOrg?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Display Name</Label><Input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Custom brand name" /></div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload logo — click or drop image here"
                onClick={() => { if (!logoUploading) logoInputRef.current?.click(); }}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !logoUploading) { e.preventDefault(); logoInputRef.current?.click(); } }}
                onDragEnter={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (logoUploading) return;
                  dragDepthRef.current += 1;
                  if (e.dataTransfer?.types?.includes('Files')) setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (e.dataTransfer) e.dataTransfer.dropEffect = logoUploading ? 'none' : 'copy';
                }}
                onDragLeave={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                  if (dragDepthRef.current === 0) setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  dragDepthRef.current = 0;
                  setIsDragging(false);
                  if (logoUploading) return;
                  const files = Array.from(e.dataTransfer?.files || []);
                  const file = files.find(f => f.type.startsWith('image/')) || files[0];
                  if (!file) { toast.error('No file detected in the drop'); return; }
                  void handleLogoUpload(file);
                }}
                className={`relative flex items-center gap-3 rounded-lg border-2 border-dashed p-3 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isDragging
                    ? 'border-primary bg-primary/10 scale-[1.01] shadow-lg shadow-primary/20'
                    : 'border-border hover:border-primary/50 hover:bg-muted/40'
                } ${logoUploading ? 'opacity-70 cursor-wait' : ''}`}
              >
                <div className="relative pointer-events-none">
                  <OrgLogo
                    src={brandLogoUrl}
                    name={brandingOrg?.name || 'Logo'}
                    tint={brandPrimaryColor}
                    size="editor"
                    dashed={!brandLogoUrl}
                  />
                  {logoUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pointer-events-none">
                  <p className="text-sm font-medium text-foreground">
                    {isDragging ? 'Drop image to upload' : brandLogoUrl ? 'Drop or click to replace logo' : 'Drop or click to upload logo'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    PNG, JPG, WebP, SVG · up to 2 MB
                  </p>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleLogoUpload(f); }}
                />
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button type="button" variant="outline" size="sm" disabled={logoUploading} onClick={() => logoInputRef.current?.click()}>
                    {logoUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {brandLogoUrl ? 'Replace' : 'Browse'}
                  </Button>
                  {brandLogoUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setBrandLogoUrl(''); setLogoUploadedAt(null); }}>
                      Remove
                    </Button>
                  )}
                </div>
                {isDragging && (
                  <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" />
                )}
              </div>
              {logoUploadError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {logoUploadError}
                </p>
              )}
              {!logoUploadError && logoUploadedAt && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Uploaded to storage. Click Save Branding to apply.
                </p>
              )}
              <Input
                value={brandLogoUrl}
                onChange={e => setBrandLogoUrl(e.target.value)}
                placeholder="…or paste an https:// image URL"
              />
              <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or SVG. Max 2 MB.</p>
            </div>
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={brandPrimaryColor} onChange={e => setBrandPrimaryColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                <Input value={brandPrimaryColor} onChange={e => setBrandPrimaryColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            {brandLogoUrl && (
              <div className="border rounded-md p-4 flex items-center gap-3">
                <OrgLogo src={brandLogoUrl} name={brandingOrg?.name || 'Logo'} tint={brandPrimaryColor} size="card" />
                <span className="font-medium" style={{ color: brandPrimaryColor }}>{brandName || brandingOrg?.name}</span>
              </div>
            )}
            <Button className="w-full" disabled={savingBranding || logoUploading} onClick={handleSaveBranding}>
              {savingBranding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Branding'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Reusable logo display ---------- */
function OrgLogo({
  src,
  name,
  tint,
  size = 'card',
  dashed = false,
}: {
  src?: string | null;
  name: string;
  tint?: string | null;
  size?: 'card' | 'editor';
  dashed?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const dim = size === 'editor' ? 'w-16' : 'w-12 sm:w-14';
  const iconSize = size === 'editor' ? 'h-6 w-6' : 'h-5 w-5';
  const tintStyle = tint ? { backgroundColor: `${tint}1A` } : undefined; // 10% alpha
  const showImage = src && !errored;
  return (
    <div
      className={`${dim} aspect-square shrink-0 rounded-lg overflow-hidden border ${dashed ? 'border-dashed' : 'border-border'} bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center`}
      style={!showImage ? tintStyle : undefined}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={`${name} logo`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center"
          onError={() => setErrored(true)}
        />
      ) : (
        <Building2 className={`${iconSize} text-muted-foreground`} />
      )}
    </div>
  );
}
