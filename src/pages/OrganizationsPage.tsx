import { useEffect, useState } from 'react';
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
import { Plus, Trash2, UserPlus, UserMinus, Building2, Palette } from 'lucide-react';
import { Input as ColorInput } from '@/components/ui/input';

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
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {o.name}
                      {!o.is_active && <Badge variant="destructive" className="text-xs">Disabled</Badge>}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">/{o.slug}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{o.member_count} members</Badge>
                  <Button variant="outline" size="sm" onClick={() => openMembers(o)}><UserPlus className="mr-1 h-3 w-3" />Manage</Button>
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
    </div>
  );
}
