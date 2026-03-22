import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRBAC } from '@/hooks/useRBAC';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function PaymentGatewayConfig() {
  const { isAdmin } = useRBAC();
  const [status, setStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking');
  const [mode, setMode] = useState('sandbox');
  const [appId, setAppId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configMode, setConfigMode] = useState('sandbox');

  useEffect(() => {
    checkHealth();
  }, []);

  async function checkHealth() {
    try {
      const { data, error } = await supabase.functions.invoke('cashfree-order', {
        body: { action: 'health' },
      });
      if (error) throw error;
      setStatus(data?.configured ? 'connected' : 'not_connected');
      setMode(data?.mode ?? 'sandbox');
    } catch {
      setStatus('not_connected');
    }
  }

  async function handleSave() {
    if (!appId.trim() || !secretKey.trim()) {
      toast.error('Both App ID and Secret Key are required');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('cashfree-order', {
        body: {
          action: 'save_config',
          app_id: appId.trim(),
          secret_key: secretKey.trim(),
          mode: configMode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Payment gateway configured successfully');
      setAppId('');
      setSecretKey('');
      await checkHealth();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

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
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Mode</span>
          <Badge variant="secondary">{mode === 'production' ? 'Production' : 'Sandbox (Test)'}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Supported Methods</span>
          <span className="text-sm font-medium">UPI, Cards, NetBanking, Wallets</span>
        </div>

        {isAdmin && (
          <>
            <Separator />
            <p className="text-sm font-medium text-foreground">Configure Credentials</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cf-app-id" className="text-sm">App ID</Label>
                <Input
                  id="cf-app-id"
                  placeholder="Enter Cashfree App ID"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-secret" className="text-sm">Secret Key</Label>
                <div className="relative">
                  <Input
                    id="cf-secret"
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Enter Cashfree Secret Key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    autoComplete="off"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Environment</Label>
                <Select value={configMode} onValueChange={setConfigMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Test)</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save Configuration'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your credentials from the{' '}
              <a
                href="https://merchant.cashfree.com/merchants/login"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Cashfree Dashboard
              </a>
              . Use Sandbox keys for testing.
            </p>
          </>
        )}

        {!isAdmin && (
          <p className="text-xs text-muted-foreground mt-2">
            API keys are securely stored. Contact your administrator to update credentials.
          </p>
        )}
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

        <PaymentGatewayConfig />

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
