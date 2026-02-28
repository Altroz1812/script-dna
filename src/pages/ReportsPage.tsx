import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Users, CreditCard, ClipboardCheck, GraduationCap } from 'lucide-react';

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminQuery('get_stats').then(setStats).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Reports</h1>
      <p className="text-muted-foreground text-sm">Aggregated overview of platform metrics</p>
      {loading ? <p className="text-muted-foreground">Loading...</p> : stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle><Users className="h-4 w-4 text-blue-500" /></CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.totalUsers}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Students</CardTitle><GraduationCap className="h-4 w-4 text-green-500" /></CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.roleCounts?.student ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Total Payments</CardTitle><CreditCard className="h-4 w-4 text-emerald-500" /></CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.totalPayments}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">Courses</CardTitle><ClipboardCheck className="h-4 w-4 text-orange-500" /></CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.totalCourses}</p></CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>Role Distribution</CardTitle></CardHeader>
        <CardContent>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(stats.roleCounts || {}).map(([role, count]) => (
                <div key={role} className="flex justify-between border rounded-md p-3">
                  <span className="capitalize text-sm">{role}</span>
                  <span className="font-bold">{count as number}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
