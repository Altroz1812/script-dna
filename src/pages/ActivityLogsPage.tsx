import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Activity, LogIn, Shield, Users, History } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
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
  user_agent?: string | null;
  error_code?: string | null;
  attempted_at: string;
}

interface ActiveSession {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: string | null;
  ip_address: string | null;
  user_agent: string | null;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}

export default function ActivityLogsPage() {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [sessionHistory, setSessionHistory] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadAll = () => {
    Promise.all([
      adminQuery('list_activity_logs').catch(() => ({})),
      adminQuery('list_active_sessions').catch(() => ({})),
      adminQuery('list_session_history', { limit: 200 }).catch(() => ({})),
    ]).then(([logs, active, history]: any[]) => {
      setActivityLogs(logs.activity_logs ?? []);
      setLoginAttempts(logs.login_attempts ?? []);
      setActiveSessions(active.sessions ?? []);
      setSessionHistory(history.sessions ?? []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadAll();
    const t = window.setInterval(loadAll, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const filteredLogins = loginAttempts.filter(
    (l) => !search || l.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredActivity = activityLogs.filter(
    (a) => !search ||
      a.action.toLowerCase().includes(search.toLowerCase()) ||
      a.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
      a.user_email?.toLowerCase().includes(search.toLowerCase())
  );
  const filterSession = (s: ActiveSession) => !search ||
    s.user_email.toLowerCase().includes(search.toLowerCase()) ||
    s.user_name.toLowerCase().includes(search.toLowerCase());
  const filteredActive = activeSessions.filter(filterSession);
  const filteredHistory = sessionHistory.filter(filterSession);

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const formatDuration = (start: string, end: string | null) => {
    const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60); const m = mins % 60;
    return `${h}h ${m}m`;
  };
  const shortUA = (ua: string | null | undefined) => {
    if (!ua) return '—';
    const m = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
    const os = ua.match(/\((?:[^)]*?)(Mac OS X [\d_]+|Windows NT [\d.]+|Android [\d.]+|iPhone OS [\d_]+|Linux[^)]*)/);
    return [m?.[0], os?.[1]].filter(Boolean).join(' · ') || ua.slice(0, 40);
  };
  const isLive = (lastSeen: string) => Date.now() - new Date(lastSeen).getTime() < 60_000;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> Activity Logs
          </h1>
          <p className="text-muted-foreground text-sm">Active users, login attempts, session history and system activity</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <TableSkeleton columns={5} rows={8} />
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Active Users ({activeSessions.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1">
              <History className="h-3 w-3" /> Sessions ({sessionHistory.length})
            </TabsTrigger>
            <TabsTrigger value="logins" className="flex items-center gap-1">
              <LogIn className="h-3 w-3" /> Login Attempts ({loginAttempts.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1">
              <Activity className="h-3 w-3" /> Activity ({activityLogs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Signed in</TableHead>
                      <TableHead>Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActive.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No active users right now</TableCell></TableRow>
                    ) : filteredActive.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${isLive(s.last_seen_at) ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                          {s.user_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.user_email}</TableCell>
                        <TableCell>{s.role ? <Badge variant="secondary">{s.role}</Badge> : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{s.ip_address || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{shortUA(s.user_agent)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(s.started_at)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDuration(s.last_seen_at, null)} ago</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Ended</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Device</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No sessions recorded yet</TableCell></TableRow>
                    ) : filteredHistory.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.user_name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.user_email}</TableCell>
                        <TableCell>{s.role ? <Badge variant="secondary">{s.role}</Badge> : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(s.started_at)}</TableCell>
                        <TableCell className="text-muted-foreground">{s.ended_at ? formatDate(s.ended_at) : <Badge variant="default">Active</Badge>}</TableCell>
                        <TableCell>{formatDuration(s.started_at, s.ended_at)}</TableCell>
                        <TableCell className="text-muted-foreground">{s.ip_address || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{shortUA(s.user_agent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logins">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No login attempts found</TableCell>
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
                          <TableCell className="text-muted-foreground text-xs">{l.error_code || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{l.ip_address || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{shortUA(l.user_agent)}</TableCell>
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
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivity.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No activity logs yet</TableCell>
                      </TableRow>
                    ) : (
                      filteredActivity.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">
                            {a.user_name === 'System'
                              ? <Badge variant="outline">System</Badge>
                              : (a.user_name || '—')}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{a.user_email || '—'}</TableCell>
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
