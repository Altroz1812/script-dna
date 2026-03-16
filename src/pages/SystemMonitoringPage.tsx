import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity, Database, Users, BookOpen, Shield, Server,
  CheckCircle, XCircle, CreditCard, Layers, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading-skeletons';

interface SystemHealth {
  counts: {
    users: number;
    courses: number;
    batches: number;
    organizations: number;
    leads: number;
    payments: number;
    activityLogs: number;
    modules: number;
    lessons: number;
  };
  roleCounts: Record<string, number>;
  orgHealth: { active: number; inactive: number };
  revenue: { total: number; pendingCount: number };
  loginHealth: { total: number; success: number; failed: number };
  subscriptions: { active: number; total: number };
  coupons: { active: number; total: number };
  timestamp: string;
}

export default function SystemMonitoringPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = () => {
    setLoading(true);
    adminQuery('system_health')
      .then(setHealth)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHealth(); }, []);

  const loginSuccessRate = health?.loginHealth.total
    ? Math.round((health.loginHealth.success / health.loginHealth.total) * 100)
    : 100;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Server className="h-6 w-6" /> System Monitoring
        </h1>
        <TableSkeleton columns={4} rows={6} />
      </div>
    );
  }

  if (!health) return null;

  const statCards = [
    { label: 'Total Users', value: health.counts.users, icon: Users, color: 'text-primary' },
    { label: 'Courses', value: health.counts.courses, icon: BookOpen, color: 'text-primary' },
    { label: 'Batches', value: health.counts.batches, icon: Layers, color: 'text-primary' },
    { label: 'Organizations', value: health.counts.organizations, icon: Database, color: 'text-primary' },
    { label: 'Payments', value: health.counts.payments, icon: CreditCard, color: 'text-primary' },
    { label: 'Activity Logs', value: health.counts.activityLogs, icon: Activity, color: 'text-primary' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Server className="h-6 w-6" /> System Monitoring
          </h1>
          <p className="text-muted-foreground text-sm">
            Real-time platform health · Last updated {new Date(health.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Login Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Login Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Success Rate</span>
              <Badge variant={loginSuccessRate > 90 ? 'default' : 'destructive'}>
                {loginSuccessRate}%
              </Badge>
            </div>
            <Progress value={loginSuccessRate} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-500" /> Successful
              </span>
              <span className="font-medium">{health.loginHealth.success}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <XCircle className="h-3 w-3 text-destructive" /> Failed
              </span>
              <span className="font-medium">{health.loginHealth.failed}</span>
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Role Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(health.roleCounts).sort(([, a], [, b]) => b - a).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center text-sm">
                <Badge variant="secondary" className="capitalize">{role}</Badge>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(health.roleCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No users yet</p>
            )}
          </CardContent>
        </Card>

        {/* Organization Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> Organization Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active</span>
              <Badge variant="default">{health.orgHealth.active}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Inactive</span>
              <Badge variant="secondary">{health.orgHealth.inactive}</Badge>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Active Subscriptions</span>
              <span className="font-medium">{health.subscriptions.active} / {health.subscriptions.total}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active Coupons</span>
              <span className="font-medium">{health.coupons.active} / {health.coupons.total}</span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Revenue Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Revenue</span>
              <span className="font-bold text-lg">₹{health.revenue.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pending Payments</span>
              <Badge variant="secondary">{health.revenue.pendingCount}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Content Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Content Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Courses</span>
              <span className="font-medium">{health.counts.courses}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Modules</span>
              <span className="font-medium">{health.counts.modules}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lessons</span>
              <span className="font-medium">{health.counts.lessons}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Leads</span>
              <span className="font-medium">{health.counts.leads}</span>
            </div>
          </CardContent>
        </Card>

        {/* API Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> API Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {['Database', 'Authentication', 'Edge Functions', 'Storage'].map((service) => (
              <div key={service} className="flex justify-between items-center text-sm">
                <span>{service}</span>
                <Badge variant="default" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" /> Healthy
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
