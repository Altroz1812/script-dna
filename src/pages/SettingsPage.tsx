import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CreditCard, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

function PaymentGatewayStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking');

  useEffect(() => {
    async function check() {
      try {
        const { data, error } = await supabase.functions.invoke('cashfree-order', {
          body: { action: 'health' },
        });
        setStatus(data?.configured ? 'connected' : 'not_connected');
      } catch {
        setStatus('not_connected');
      }
    }
    check();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Payment Gateway
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Provider</span>
          <span className="text-sm font-medium">Cashfree</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Status</span>
          {status === 'checking' ? (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking…
            </Badge>
          ) : status === 'connected' ? (
            <Badge variant="default" className="gap-1 bg-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" /> Not Configured
            </Badge>
          )}
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Mode</span>
          <Badge variant="secondary">Sandbox (Test)</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Supported Methods</span>
          <span className="text-sm font-medium">UPI, Cards, NetBanking, Wallets</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          API keys are securely stored as backend secrets. Contact your administrator to update credentials.
        </p>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <p className="text-muted-foreground text-sm">System configuration and info</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Application</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">App Name</span><span className="text-sm font-medium">AuraPen</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Version</span><span className="text-sm font-medium">1.0.0</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Environment</span><Badge variant="secondary">Development</Badge></div>
          </CardContent>
        </Card>

        <PaymentGatewayStatus />

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