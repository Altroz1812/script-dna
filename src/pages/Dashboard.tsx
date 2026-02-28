import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.displayName || profile?.email || 'User'}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {profile ? ROLE_LABELS[profile.role] : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          <p>
            This dashboard adapts to your role. Navigate using the sidebar to access
            your available modules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
