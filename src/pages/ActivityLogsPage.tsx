import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Activity, LogIn, Shield } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: any;
  ip_address: string | null;
  created_at: string;
}

interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  ip_address: string | null;
  attempted_at: string;
}

export default function ActivityLogsPage() {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    adminQuery('list_activity_logs')
      .then((data) => {
        setActivityLogs(data.activity_logs ?? []);
        setLoginAttempts(data.login_attempts ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredLogins = loginAttempts.filter(
    (l) => !search || l.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredActivity = activityLogs.filter(
    (a) => !search || a.action.toLowerCase().includes(search.toLowerCase()) || a.entity_type?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> Activity Logs
          </h1>
          <p className="text-muted-foreground text-sm">Monitor login attempts and system activity</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <TableSkeleton columns={5} rows={8} />
      ) : (
        <Tabs defaultValue="logins">
          <TabsList>
            <TabsTrigger value="logins" className="flex items-center gap-1">
              <LogIn className="h-3 w-3" /> Login Attempts ({loginAttempts.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1">
              <Activity className="h-3 w-3" /> Activity ({activityLogs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logins">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No login attempts found</TableCell>
                      </TableRow>
                    ) : (
                      filteredLogins.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.email}</TableCell>
                          <TableCell>
                            <Badge variant={l.success ? 'default' : 'destructive'}>
                              {l.success ? 'Success' : 'Failed'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{l.ip_address || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(l.attempted_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivity.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No activity logs yet</TableCell>
                      </TableRow>
                    ) : (
                      filteredActivity.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.action}</TableCell>
                          <TableCell>
                            {a.entity_type && <Badge variant="secondary">{a.entity_type}</Badge>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{a.ip_address || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
