import { useEffect, useState } from 'react';
import { adminQuery } from '@/services/api/adminService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, Layers, Building2, UserPlus, CreditCard, GraduationCap, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Stats {
  totalUsers: number;
  totalCourses: number;
  totalBatches: number;
  totalOrgs: number;
  totalLeads: number;
  totalPayments: number;
  roleCounts: Record<string, number>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    adminQuery('get_stats').then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: 'Students', value: stats.roleCounts?.student ?? 0, icon: GraduationCap, color: 'text-green-500' },
    { label: 'Teachers', value: stats.roleCounts?.teacher ?? 0, icon: UserCheck, color: 'text-purple-500' },
    { label: 'Courses', value: stats.totalCourses, icon: BookOpen, color: 'text-orange-500' },
    { label: 'Batches', value: stats.totalBatches, icon: Layers, color: 'text-cyan-500' },
    { label: 'Organizations', value: stats.totalOrgs, icon: Building2, color: 'text-pink-500' },
    { label: 'Leads', value: stats.totalLeads, icon: UserPlus, color: 'text-yellow-500' },
    { label: 'Payments', value: stats.totalPayments, icon: CreditCard, color: 'text-emerald-500' },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Super Admin Overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/courses')}>+ Course</Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/leads')}>+ Lead</Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/users')}>+ User</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading stats...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map(c => (
            <Card key={c.label} className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
