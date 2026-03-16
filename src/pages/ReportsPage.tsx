import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Users, CreditCard, ClipboardCheck, GraduationCap, TrendingUp,
  Building2, DollarSign, BarChart3, Activity
} from 'lucide-react';
import { StatCardsSkeleton, TableSkeleton } from '@/components/ui/loading-skeletons';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
];

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [orgPerf, setOrgPerf] = useState<any[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminQuery('get_stats'),
      adminQuery('revenue_analytics'),
      adminQuery('org_performance'),
      adminQuery('student_trends'),
    ])
      .then(([s, r, o, t]) => {
        setStats(s);
        setRevenue(r);
        setOrgPerf(o);
        setTrends(t);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const monthlyRevenueData = revenue
    ? Object.entries(revenue.monthlyRevenue).map(([month, amount]) => ({
        month: formatMonth(month as string),
        revenue: amount as number,
      }))
    : [];

  const attendanceData = trends
    ? Object.entries(trends.monthlyAttendance).map(([month, data]: [string, any]) => ({
        month: formatMonth(month),
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
        present: data.present,
        total: data.total,
      }))
    : [];

  const roleData = stats
    ? Object.entries(stats.roleCounts || {}).map(([role, count]) => ({
        name: role.charAt(0).toUpperCase() + role.slice(1),
        value: count as number,
      }))
    : [];

  function formatMonth(m: string) {
    const [y, mo] = m.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
  }

  const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN')}`;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
        <StatCardsSkeleton count={4} />
        <TableSkeleton columns={5} rows={5} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Reports & Analytics
        </h1>
        <p className="text-muted-foreground text-sm">Platform-wide metrics, revenue, and performance</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(revenue?.totalRevenue ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{revenue?.totalTransactions ?? 0} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(revenue?.pendingRevenue ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalUsers ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{Math.round(trends?.progressSummary?.avgCompletion ?? 0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {trends?.progressSummary?.completed ?? 0} completed / {trends?.progressSummary?.total ?? 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="institutes">Institute Performance</TabsTrigger>
          <TabsTrigger value="students">Student Trends</TabsTrigger>
          <TabsTrigger value="roles">Role Distribution</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Revenue (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={monthlyRevenueData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revenueGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">No revenue data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Institute Performance Tab */}
        <TabsContent value="institutes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" /> Institute Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institute</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                    <TableHead className="text-right">Courses</TableHead>
                    <TableHead className="text-right">Batches</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgPerf.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No institutes found</TableCell>
                    </TableRow>
                  ) : (
                    orgPerf.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>
                          <Badge variant={o.is_active ? 'default' : 'destructive'}>
                            {o.is_active ? 'Active' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{o.members}</TableCell>
                        <TableCell className="text-right">{o.courses}</TableCell>
                        <TableCell className="text-right">{o.batches}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(o.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {orgPerf.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Revenue by Institute</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={orgPerf.filter((o) => o.revenue > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Student Trends Tab */}
        <TabsContent value="students" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{trends?.progressSummary?.inProgress ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-500">{trends?.progressSummary?.completed ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Avg Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{Math.round(trends?.progressSummary?.avgCompletion ?? 0)}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-5 w-5" /> Attendance Rate (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceData.some((d) => d.total > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'rate') return [`${value}%`, 'Attendance Rate'];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">No attendance data in the last 6 months</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Distribution Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Role Distribution</CardTitle></CardHeader>
              <CardContent>
                {roleData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={roleData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {roleData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-12">No role data</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {roleData.map((r, i) => (
                    <div key={r.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-sm">{r.name}</span>
                      </div>
                      <span className="font-bold">{r.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
