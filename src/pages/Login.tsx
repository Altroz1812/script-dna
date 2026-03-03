import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Loader2, User, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, type AppRole } from '@/types/roles';
import { checkRateLimit, resetRateLimit, formatRetryTime, sanitizeEmail } from '@/lib/security';
import { MorphingBlob } from '@/components/ui/morphing-blob';

const DEMO_ACCOUNTS: { email: string; password: string; role: AppRole; name: string; org?: string }[] = [
  { email: 'superadmin@demo.com', password: 'Demo1234!', role: 'superadmin', name: 'Super Admin', org: 'Platform' },
  { email: 'admin@demo.com', password: 'Demo1234!', role: 'admin', name: 'Admin', org: 'Sunrise Academy' },
  { email: 'teacher@demo.com', password: 'Demo1234!', role: 'teacher', name: 'Teacher', org: 'Sunrise Academy' },
  { email: 'student@demo.com', password: 'Demo1234!', role: 'student', name: 'Student', org: 'Sunrise Academy' },
  { email: 'support@demo.com', password: 'Demo1234!', role: 'support', name: 'Support', org: 'Bright Future' },
  { email: 'parent@demo.com', password: 'Demo1234!', role: 'parent', name: 'Parent', org: 'Sunrise Academy' },
];

const ROLE_BORDER_COLORS: Record<AppRole, string> = {
  superadmin: 'border-l-purple-500',
  admin: 'border-l-blue-500',
  teacher: 'border-l-emerald-500',
  student: 'border-l-orange-500',
  support: 'border-l-cyan-500',
  parent: 'border-l-pink-500',
};

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

    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    const rateCheck = checkRateLimit(`login:${cleanEmail}`);
    if (!rateCheck.allowed) {
      toast({
        title: 'Too many attempts',
        description: `Account temporarily locked. Try again in ${formatRetryTime(rateCheck.retryAfterMs)}.`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await signIn(cleanEmail, password);
      resetRateLimit(`login:${cleanEmail}`);
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated grid pattern */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Background effects */}
      <MorphingBlob className="w-[600px] h-[600px] -top-40 -left-40 opacity-50" color="hsl(265 90% 65% / 0.12)" />
      <MorphingBlob className="w-[500px] h-[500px] -bottom-32 -right-32 opacity-40" color="hsl(12 90% 65% / 0.1)" />
      <MorphingBlob className="w-[400px] h-[400px] top-1/3 right-1/4 opacity-30" color="hsl(165 80% 45% / 0.1)" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
        className="w-full max-w-md space-y-5 relative z-10"
      >
        <Card className="glass-panel border-white/[0.12]">
          <CardHeader className="text-center space-y-3">
            <motion.div
              className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-coral to-accent flex items-center justify-center shadow-lg shadow-primary/30 relative"
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Gradient ring */}
              <div className="absolute inset-[-3px] rounded-2xl bg-gradient-to-br from-primary via-coral to-accent opacity-40 blur-sm" />
              <GraduationCap className="w-7 h-7 text-white relative z-10" />
            </motion.div>
            <CardTitle className="text-xl font-display">Welcome back</CardTitle>
            <CardDescription>Sign in to Live Classroom</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-white/[0.04] border-white/[0.1] focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-white/[0.04] border-white/[0.1] focus:border-primary/50 transition-colors"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full bg-gradient-to-r from-primary via-coral to-accent hover:opacity-90 transition-opacity text-white border-0 shadow-lg shadow-primary/20" disabled={loading || !!demoLoading}>
                {loading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Signing in…</span>
                ) : 'Sign In'}
              </Button>
              <div className="flex justify-between w-full text-sm">
                <Link to="/forgot-password" className="text-muted-foreground hover:text-primary transition-colors">Forgot password?</Link>
                <Link to="/signup" className="text-muted-foreground hover:text-primary transition-colors">Create account</Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Demo Logins */}
        <Card className="glass-panel border-white/[0.12]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-coral animate-pulse-glow" />
              Quick Demo Login
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account, i) => (
              <motion.div
                key={account.email}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full justify-start gap-2 h-auto py-2.5 px-3 bg-white/[0.03] border-white/[0.08] border-l-[3px] ${ROLE_BORDER_COLORS[account.role]} hover:bg-white/[0.06] hover:border-primary/30 transition-all duration-300`}
                  disabled={!!demoLoading || loading}
                  onClick={() => handleDemoLogin(account)}
                >
                  {demoLoading === account.email ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-primary" />
                  ) : (
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-medium">{account.name}</span>
                    <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[account.role]}{account.org ? ` · ${account.org}` : ''}</span>
                  </div>
                </Button>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
