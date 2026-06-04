import { useEffect, useMemo, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/types/roles';
import { Building2, Search } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

interface UserRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  organization_ids: string[];
}

interface Org { id: string; name: string }

export default function RolesPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [assignUser, setAssignUser] = useState<UserRow | null>(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [orgSearch, setOrgSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminQuery('list_users'),
      adminQuery('list_organizations'),
    ])
      .then(([u, o]) => {
        setUsers(u || []);
        setOrgs((o || []).map((x: any) => ({ id: x.id, name: x.name })));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users) c[u.role] = (c[u.role] || 0) + 1;
    return c;
  }, [users]);

  const filtered = useMemo(() => users.filter((u) => {
    const s = search.toLowerCase();
    const matchS = !s || u.display_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
    const matchR = roleFilter === 'all' || u.role === roleFilter;
    return matchS && matchR;
  }), [users, search, roleFilter]);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminQuery('change_role', { user_id: userId, role });
      toast.success('Role updated');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openAssign = (u: UserRow) => {
    setAssignUser(u);
    setSelectedOrgIds(new Set(u.organization_ids || []));
    setOrgSearch('');
  };

  const toggleOrg = (id: string) => {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!assignUser) return;
    setSaving(true);
    try {
      await adminQuery('set_user_organizations', {
        user_id: assignUser.user_id,
        organization_ids: Array.from(selectedOrgIds),
      });
      toast.success('Organizations updated');
      setAssignUser(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || id.slice(0, 6);
  const filteredOrgs = orgs.filter((o) => !orgSearch || o.name.toLowerCase().includes(orgSearch.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Assign roles and map users to one or more organizations. Use the Users page for account creation, passwords and profile edits.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{v}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{roleCounts[k] || 0}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? <TableSkeleton columns={4} rows={6} /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Organizations</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.display_name || '—'}</TableCell>
                    <TableCell>{u.email || '—'}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {(u.organization_ids || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          u.organization_ids.slice(0, 3).map((id) => (
                            <Badge key={id} variant="secondary" className="text-xs">{orgName(id)}</Badge>
                          ))
                        )}
                        {u.organization_ids.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{u.organization_ids.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.role === 'student' || u.role === 'parent' ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => openAssign(u)}>
                          <Building2 className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!assignUser} onOpenChange={(v) => { if (!v) setAssignUser(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Assign Organizations — {assignUser?.display_name || assignUser?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search organizations..."
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
            />
            <div className="max-h-80 overflow-y-auto space-y-1 border rounded-md p-2">
              {filteredOrgs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No organizations</p>
              ) : (
                filteredOrgs.map((o) => (
                  <label
                    key={o.id}
                    className="flex items-center gap-3 px-2 py-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedOrgIds.has(o.id)}
                      onCheckedChange={() => toggleOrg(o.id)}
                    />
                    <span className="text-sm">{o.name}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {selectedOrgIds.size} organization{selectedOrgIds.size === 1 ? '' : 's'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignUser(null)}>Cancel</Button>
            <Button onClick={saveAssignments} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
