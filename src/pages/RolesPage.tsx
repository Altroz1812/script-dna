import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/types/roles';
import { Shield } from 'lucide-react';

export default function RolesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminQuery('list_users').then(setUsers).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const roleCounts: Record<string, number> = {};
  for (const u of users) roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;

  const handleChange = async (userId: string, role: string) => {
    try {
      await adminQuery('change_role', { user_id: userId, role });
      toast.success('Role updated');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <Card key={k}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{v}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{roleCounts[k] || 0}</p></CardContent>
          </Card>
        ))}
      </div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.display_name || '—'}</TableCell>
                    <TableCell>{u.email || '—'}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={v => handleChange(u.user_id, v)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
