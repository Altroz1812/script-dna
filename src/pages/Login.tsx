import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, type AppRole } from '@/types/roles';

const DEMO_ACCOUNTS: { email: string; password: string; role: AppRole; name: string; org?: string }[] = [
  { email: 'superadmin@demo.com', password: 'Demo1234!', role: 'superadmin', name: 'Super Admin', org: 'Platform' },
  { email: 'admin@demo.com', password: 'Demo1234!', role: 'admin', name: 'Admin', org: 'Sunrise Academy' },
  { email: 'teacher@demo.com', password: 'Demo1234!', role: 'teacher', name: 'Teacher', org: 'Sunrise Academy' },
  { email: 'student@demo.com', password: 'Demo1234!', role: 'student', name: 'Student', org: 'Sunrise Academy' },
  { email: 'support@demo.com', password: 'Demo1234!', role: 'support', name: 'Support', org: 'Bright Future' },
  { email: 'parent@demo.com', password: 'Demo1234!', role: 'parent', name: 'Parent', org: 'Sunrise Academy' },
];

function getErrorMessage(err: any): string {
  const msg = err?.message ?? '';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return 'Network error — please check your connection and try again.';
  }
  if (msg.includes('Invalid login')) return 'Invalid email or password.';
  return msg || 'Sign in failed. Please try again.';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const { signIn, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      toast({ title: 'Sign in failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (account: typeof DEMO_ACCOUNTS[0]) => {
    if (demoLoading) return;
    setDemoLoading(account.email);
    try {
      await signIn(account.email, account.password);
    } catch (err: any) {
      toast({ title: 'Demo login failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-border/50">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to Live Classroom</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || !!demoLoading}>
                {loading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Signing in…</span>
                ) : 'Sign In'}
              </Button>
              <div className="flex justify-between w-full text-sm">
                <Link to="/forgot-password" className="text-muted-foreground hover:text-primary">Forgot password?</Link>
                <Link to="/signup" className="text-muted-foreground hover:text-primary">Create account</Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Demo Logins */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quick Demo Login</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                size="sm"
                className="justify-start gap-2 h-auto py-2 px-3"
                disabled={!!demoLoading || loading}
                onClick={() => handleDemoLogin(account)}
              >
                {demoLoading === account.email ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                ) : (
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium">{account.name}</span>
                  <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[account.role]}{account.org ? ` · ${account.org}` : ''}</span>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
