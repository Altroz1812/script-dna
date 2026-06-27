import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Globe2, Loader2, ArrowRight, Users, Plus, Pencil, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { adminQuery } from '@/services/api/adminService';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MorphingBlob } from '@/components/ui/morphing-blob';

export default function SelectOrganizationPage() {
  const navigate = useNavigate();
  const { setActiveOrg, availableOrgs, orgsLoading } = useActiveOrg();
  const { profile, loading: authLoading } = useAuth();
  const { isSuperAdmin } = useRBAC();

  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [newOrgWebsite, setNewOrgWebsite] = useState('');
  const [newOrgContact, setNewOrgContact] = useState('');
  const [newOrgPoc, setNewOrgPoc] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingEditLogo, setUploadingEditLogo] = useState(false);

  // Edit branding
  const [editOrg, setEditOrg] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');
  const [editLogo, setEditLogo] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editPoc, setEditPoc] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Members
  const [memberOrg, setMemberOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!profile) { navigate('/login', { replace: true }); return; }
    if (isSuperAdmin) {
      adminQuery('list_organizations', { __skip_org_filter: true })
        .then(setOrgs)
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false));
    } else {
      // Non-SuperAdmin: pick only from their memberships
      if (orgsLoading) return;
      if (availableOrgs.length <= 1) {
        // Single-org user shouldn't see this page
        navigate('/dashboard', { replace: true });
        return;
      }
      setOrgs(availableOrgs.map(o => ({ id: o.id, name: o.name })));
      setLoading(false);
    }
  }, [authLoading, profile, isSuperAdmin, navigate, availableOrgs, orgsLoading]);

  const loadOrgs = () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    adminQuery('list_organizations', { __skip_org_filter: true })
      .then(setOrgs)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleLogoFile = async (file: File | undefined, setter: (v: string) => void, setBusy: (v: boolean) => void) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Logo must be a PNG or JPEG image');
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error('Logo must be smaller than 500 KB');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setter(dataUrl);
      toast.success('Logo ready');
    } catch (e: any) {
      toast.error(e.message || 'Failed to read file');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = newOrgName.trim();
    const slug = newOrgSlug.trim() || slugify(name);
    const address = newOrgAddress.trim();
    const website = newOrgWebsite.trim();
    const contact = newOrgContact.trim();
    const poc = newOrgPoc.trim();
    const email = newOrgEmail.trim();
    const logo = newOrgLogo.trim();
    if (!name) { toast.error('Organization name is required'); return; }
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) { toast.error('Slug must contain only lowercase letters, numbers and dashes'); return; }
    if (!address) { toast.error('Address is required'); return; }
    if (!website) { toast.error('Website is required'); return; }
    if (!contact || !/^[+\d][\d\s\-()]{6,}$/.test(contact)) { toast.error('Valid contact number is required'); return; }
    if (!poc) { toast.error('Point of contact is required'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Valid email is required'); return; }
    setCreating(true);
    try {
      const created: any = await adminQuery('create_organization', { name, slug });
      const newId = created?.id;
      if (newId) {
        await adminQuery('update_org_branding', {
          id: newId,
          branding: {
            display_name: name,
            logo_url: logo || null,
            primary_color: '#6366f1',
            address,
            website,
            contact_number: contact,
            point_of_contact: poc,
            email,
          },
        });
      }
      toast.success('Organization created');
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgLogo(''); setNewOrgAddress(''); setNewOrgWebsite('');
      setNewOrgContact(''); setNewOrgPoc(''); setNewOrgEmail('');
      setCreateOpen(false);
      loadOrgs();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (o: any) => {
    const b = o.branding || {};
    setEditOrg(o);
    setEditName(b.display_name || o.name || '');
    setEditColor(b.primary_color || '#6366f1');
    setEditLogo(o.logo_url || b.logo_url || '');
    setEditAddress(b.address || '');
    setEditWebsite(b.website || '');
    setEditContact(b.contact_number || '');
    setEditPoc(b.point_of_contact || '');
    setEditEmail(b.email || '');
  };

  const handleSaveEdit = async () => {
    if (!editOrg) return;
    if (!editAddress.trim()) { toast.error('Address is required'); return; }
    if (!editWebsite.trim()) { toast.error('Website is required'); return; }
    if (!editContact.trim() || !/^[+\d][\d\s\-()]{6,}$/.test(editContact.trim())) { toast.error('Valid contact number is required'); return; }
    if (!editPoc.trim()) { toast.error('Point of contact is required'); return; }
    if (!editEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) { toast.error('Valid email is required'); return; }
    setSavingEdit(true);
    try {
      await adminQuery('update_org_branding', {
        id: editOrg.id,
        branding: {
          display_name: editName || null,
          logo_url: editLogo || null,
          primary_color: editColor,
          address: editAddress.trim(),
          website: editWebsite.trim(),
          contact_number: editContact.trim(),
          point_of_contact: editPoc.trim(),
          email: editEmail.trim(),
        },
      });
      toast.success('Organization updated');
      setEditOrg(null);
      loadOrgs();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (o: any) => {
    if (!confirm(`Delete "${o.name}"? This cannot be undone.`)) return;
    try {
      await adminQuery('delete_organization', { id: o.id });
      toast.success('Organization deleted');
      loadOrgs();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  const openMembers = async (o: any) => {
    setMemberOrg(o);
    setMembers([]);
    setAllUsers([]);
    setSelectedUser('');
    try {
      const [m, u] = await Promise.all([
        adminQuery('list_org_members', { organization_id: o.id }),
        adminQuery('list_users'),
      ]);
      setMembers(m || []);
      setAllUsers(u || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load members');
    }
  };

  const addMember = async () => {
    if (!selectedUser || !memberOrg) return;
    try {
      await adminQuery('add_org_member', { organization_id: memberOrg.id, user_id: selectedUser });
      toast.success('Member added');
      setSelectedUser('');
      openMembers(memberOrg);
      loadOrgs();
    } catch (e: any) { toast.error(e.message); }
  };

  const removeMember = async (userId: string) => {
    if (!memberOrg) return;
    try {
      await adminQuery('remove_org_member', { organization_id: memberOrg.id, user_id: userId });
      toast.success('Member removed');
      openMembers(memberOrg);
      loadOrgs();
    } catch (e: any) { toast.error(e.message); }
  };

  const memberIds = new Set(members.map((m: any) => m.user_id));
  const availableUsers = allUsers.filter((u: any) => !memberIds.has(u.user_id));

  const pick = (id: string | null, name: string | null) => {
    setActiveOrg(id, name);
    toast.success(id ? `Switched to ${name}` : 'Switched to Global view');
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <MorphingBlob className="w-[700px] h-[700px] -top-40 -left-40 opacity-40" color="hsl(265 90% 65% / 0.12)" />
      <MorphingBlob className="w-[500px] h-[500px] -bottom-32 -right-32 opacity-30" color="hsl(12 90% 65% / 0.1)" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-6 sm:mb-10"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold mb-2">Choose an organization</h1>
          <p className="text-sm sm:text-base text-muted-foreground px-2">
            Pick a tenant to scope all dashboards, students, batches and finances. You can switch anytime from the header.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Global tile — SuperAdmin only */}
            {isSuperAdmin && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card
                onClick={() => pick(null, 'Global view')}
                className="glass-panel cursor-pointer hover:border-primary/40 transition-all duration-300 group h-full"
              >
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Globe2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Global view</h3>
                    <p className="text-sm text-muted-foreground">All organizations · platform-wide data</p>
                  </div>
                  <Button variant="ghost" size="sm" className="justify-start text-primary group-hover:translate-x-1 transition-transform">
                    Continue <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
            )}

            {/* Add Organisation tile — SuperAdmin only */}
            {isSuperAdmin && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card
                  onClick={() => setCreateOpen(true)}
                  className="glass-panel cursor-pointer hover:border-primary/40 transition-all duration-300 group h-full border-dashed border-2"
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col gap-3 h-full">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-primary/20 flex items-center justify-center">
                      <Plus className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base sm:text-lg">Add Organisation</h3>
                      <p className="text-sm text-muted-foreground">Create a new tenant for the platform</p>
                    </div>
                    <Button variant="ghost" size="sm" className="justify-start text-primary group-hover:translate-x-1 transition-transform pointer-events-none">
                      Create <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {orgs.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * (i + 1), duration: 0.3 }}
              >
                <Card
                  onClick={() => pick(o.id, o.name)}
                  className="glass-panel cursor-pointer hover:border-primary/40 transition-all duration-300 group h-full"
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col gap-3 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-coral/20 to-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                        {o.logo_url ? (
                          <img src={o.logo_url} alt={o.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-6 h-6 text-coral" />
                        )}
                      </div>
                      {isSuperAdmin && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Members" onClick={() => openMembers(o)}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEdit(o)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete" onClick={() => handleDelete(o)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base sm:text-lg truncate">{o.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {o.member_count ?? 0} members
                        {o.is_active === false ? <span className="ml-2 text-destructive">· inactive</span> : null}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="justify-start text-primary group-hover:translate-x-1 transition-transform">
                      Enter <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <Button
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl backdrop-blur-md bg-primary/90 hover:bg-primary text-primary-foreground sm:hidden"
          aria-label="Add organization"
        >
          <Plus className="h-7 w-7" />
        </Button>
      )}

      {/* Create dialog body — convert to a form for proper required-field UX */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="org-name-2">Name <span className="text-destructive">*</span></Label>
              <Input
                id="org-name-2"
                value={newOrgName}
                onChange={(e) => {
                  setNewOrgName(e.target.value);
                  if (!newOrgSlug || newOrgSlug === slugify(newOrgName)) {
                    setNewOrgSlug(slugify(e.target.value));
                  }
                }}
                placeholder="e.g. AuraPen Bangalore"
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="org-slug-2">Slug <span className="text-destructive">*</span></Label>
              <Input
                id="org-slug-2"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase())}
                placeholder="e.g. aurapen-bangalore"
                required
                pattern="[a-z0-9\-]+"
                minLength={2}
                maxLength={60}
                title="Lowercase letters, numbers and dashes only"
              />
              <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers and dashes only.</p>
            </div>
            <div>
              <Label htmlFor="org-logo-2">Logo URL</Label>
              <Input
                id="org-logo-2"
                value={newOrgLogo}
                onChange={(e) => setNewOrgLogo(e.target.value)}
                placeholder="https://… (optional)"
                type="url"
                maxLength={500}
              />
              <div className="mt-2 flex items-center gap-3">
                <Input
                  id="org-logo-file-2"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => handleLogoFile(e.target.files?.[0], setNewOrgLogo, setUploadingLogo)}
                  className="flex-1"
                />
                {uploadingLogo && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {newOrgLogo?.startsWith('data:image') && (
                  <img src={newOrgLogo} alt="Logo preview" className="h-10 w-10 rounded object-cover border" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Upload PNG/JPEG (max 500 KB) or paste a URL above.</p>
            </div>
            <div>
              <Label htmlFor="org-address-2">Address <span className="text-destructive">*</span></Label>
              <Textarea
                id="org-address-2"
                value={newOrgAddress}
                onChange={(e) => setNewOrgAddress(e.target.value)}
                placeholder="Street, city, state, PIN"
                required
                maxLength={300}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="org-website-2">Website <span className="text-destructive">*</span></Label>
                <Input id="org-website-2" type="url" value={newOrgWebsite} onChange={(e) => setNewOrgWebsite(e.target.value)} placeholder="https://…" required maxLength={200} />
              </div>
              <div>
                <Label htmlFor="org-contact-2">Contact Number <span className="text-destructive">*</span></Label>
                <Input id="org-contact-2" type="tel" value={newOrgContact} onChange={(e) => setNewOrgContact(e.target.value)} placeholder="+91 98765 43210" required maxLength={20} />
              </div>
              <div>
                <Label htmlFor="org-poc-2">Point of Contact <span className="text-destructive">*</span></Label>
                <Input id="org-poc-2" value={newOrgPoc} onChange={(e) => setNewOrgPoc(e.target.value)} placeholder="Full name" required maxLength={100} />
              </div>
              <div>
                <Label htmlFor="org-email-2">Email ID <span className="text-destructive">*</span></Label>
                <Input id="org-email-2" type="email" value={newOrgEmail} onChange={(e) => setNewOrgEmail(e.target.value)} placeholder="contact@org.com" required maxLength={120} />
              </div>
            </div>
            <Button type="submit" disabled={creating} className="w-full">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit branding dialog */}
      <Dialog open={!!editOrg} onOpenChange={(v) => { if (!v) setEditOrg(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit: {editOrg?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Display Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Custom display name" />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={editLogo} onChange={(e) => setEditLogo(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <Label>Address <span className="text-destructive">*</span></Label>
              <Textarea value={editAddress} onChange={(e) => setEditAddress(e.target.value)} rows={2} maxLength={300} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Website <span className="text-destructive">*</span></Label>
                <Input type="url" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} required />
              </div>
              <div>
                <Label>Contact Number <span className="text-destructive">*</span></Label>
                <Input type="tel" value={editContact} onChange={(e) => setEditContact(e.target.value)} required />
              </div>
              <div>
                <Label>Point of Contact <span className="text-destructive">*</span></Label>
                <Input value={editPoc} onChange={(e) => setEditPoc(e.target.value)} required />
              </div>
              <div>
                <Label>Email ID <span className="text-destructive">*</span></Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Primary Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full">
              {savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={!!memberOrg} onOpenChange={(v) => { if (!v) setMemberOrg(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Members: {memberOrg?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Add member…" /></SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.display_name || u.email || u.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addMember} disabled={!selectedUser}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No members yet</p>
              ) : (
                members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center justify-between border rounded-md p-2">
                    <span className="text-sm truncate">{m.profile?.display_name || m.profile?.email || m.user_id}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeMember(m.user_id)}>
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}