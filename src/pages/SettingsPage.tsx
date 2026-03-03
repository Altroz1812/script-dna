import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <p className="text-muted-foreground text-sm">System configuration and info</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Application</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">App Name</span><span className="text-sm font-medium">Aura Pen</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Version</span><span className="text-sm font-medium">1.0.0</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Environment</span><Badge variant="secondary">Development</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Backend</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Database</span><Badge variant="default">Connected</Badge></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Auth</span><Badge variant="secondary">Bypassed (Dev)</Badge></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Storage</span><Badge variant="default">Active</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Modules</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {['Dashboard', 'Users', 'Courses', 'Batches', 'Schedule', 'Attendance', 'Live Classes', 'Materials', 'Leads', 'Enrollments', 'Payments', 'Payroll', 'Reports', 'Notifications', 'Organizations', 'Roles'].map(m => (
              <div key={m} className="flex justify-between items-center">
                <span className="text-sm">{m}</span>
                <Badge variant="default" className="text-xs">Active</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
