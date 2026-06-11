import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, type AppRole } from '@/types/roles';
import { checkRateLimit, resetRateLimit, formatRetryTime, sanitizeEmail } from '@/lib/security';
import { MorphingBlob } from '@/components/ui/morphing-blob';
import aurapenLogo from '@/assets/aurapen-logo.png';
import { lovable } from '@/integrations/lovable/index';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

const DEMO_ACCOUNTS: { email: string; password: string; role: AppRole; name: string; org?: string }[] = [
  { email: 'superadmin@demo.com', password: 'Demo1234!', role: 'superadmin', name: 'Super Admin', org: 'Platform' },
  { email: 'admin@demo.com', password: 'Demo1234!', role: 'admin', name: 'Admin', org: 'Sunrise Academy' },
  { email: 'teacher@demo.com', password: 'Demo1234!', role: 'teacher', name: 'Teacher', org: 'Sunrise Academy' },
  { email: 'student@demo.com', password: 'Demo1234!', role: 'student', name: 'Student', org: 'Sunrise Academy' },
  { email: 'support@demo.com', password: 'Demo1234!', role: 'support', name: 'Support', org: 'Bright Future' },
  { email: 'parent@demo.com', password: 'Demo1234!', role: 'parent', name: 'Parent', org: 'Sunrise Academy' },
];

const ROLE_BORDER_COLORS: Record<AppRole, string> = {
  superadmin: 'border-l-[hsl(var(--accent))]',
  admin: 'border-l-[hsl(var(--accent))]',
  teacher: 'border-l-[hsl(var(--primary))]',
  student: 'border-l-[hsl(var(--glow))]',
  support: 'border-l-[hsl(var(--primary))]',
  parent: 'border-l-[hsl(var(--glow))]',
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<'email' | 'student'>('email');
  const [studentId, setStudentId] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    if (googleLoading || loading || !!demoLoading) return;
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin + '/dashboard',
        extraParams: { prompt: 'select_account' },
      });
      if (result.error) {
        toast({ title: 'Google sign-in failed', description: result.error.message, variant: 'destructive' });
        setGoogleLoading(false);
      }
      // On redirect: browser leaves this page; nothing else to do.
    } catch (err: any) {
      toast({ title: 'Google sign-in failed', description: getErrorMessage(err), variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (studentLoading) return;
    const raw = studentId.trim().toUpperCase();
    if (!raw || !/^[A-Z0-9-]{4,24}$/.test(raw)) {
      toast({ title: 'Invalid Student ID', description: 'Enter the ID printed on your student card.', variant: 'destructive' });
      return;
    }
    const rateCheck = checkRateLimit(`student-login:${raw}`);
    if (!rateCheck.allowed) {
      toast({
        title: 'Too many attempts',
        description: `Try again in ${formatRetryTime(rateCheck.retryAfterMs)}.`,
        variant: 'destructive',
      });
      return;
    }
    setStudentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('student-login-resolve', {
        body: { student_login_id: raw },
      });
      if (error) throw error;
      if ((data as any)?.error || !(data as any)?.email) {
        throw new Error('Student ID not found');
      }
      const resolvedEmail = (data as any).email as string;
      const pwd = studentPassword.trim() || raw; // default password = ID
      await signIn(resolvedEmail, pwd);
      resetRateLimit(`student-login:${raw}`);
    } catch (err: any) {
      toast({ title: 'Sign in failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setStudentLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-background p-4 py-8 sm:py-4 relative overflow-auto">
      {/* Animated grid pattern */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Background effects */}
      <MorphingBlob className="w-[600px] h-[600px] -top-40 -left-40 opacity-60" color="hsl(217 91% 60% / 0.18)" />
      <MorphingBlob className="w-[500px] h-[500px] -bottom-32 -right-32 opacity-40" color="hsl(195 100% 50% / 0.15)" />
      <MorphingBlob className="w-[400px] h-[400px] top-1/3 right-1/4 opacity-35" color="hsl(43 65% 52% / 0.12)" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
        className="w-full max-w-md space-y-5 relative z-10"
      >
        <Card className="glass-panel border-white/[0.12]">
          <CardHeader className="text-center space-y-3">
            <motion.div
              className="mx-auto w-20 h-20 flex items-center justify-center relative"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/40 via-[hsl(var(--glow)/0.35)] to-gold/30 blur-2xl" />
              <img src={aurapenLogo} alt="AuraPen" className="w-20 h-20 object-contain relative z-10 drop-shadow-[0_0_18px_hsl(var(--glow)/0.45)]" />
            </motion.div>
            <CardTitle className="text-xl font-display">Welcome back</CardTitle>
            <CardDescription>Sign in to AuraPen</CardDescription>
          </CardHeader>
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'email' | 'student')} className="px-6">
            <TabsList className="grid grid-cols-2 w-full bg-white/[0.04]">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="student">Student ID</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === 'email' ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white/[0.04] border-white/[0.12] hover:bg-white/[0.08] gap-2"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading || !!demoLoading}
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#EA4335" d="M12 11v3.2h4.5c-.2 1.2-1.4 3.5-4.5 3.5-2.7 0-4.9-2.2-4.9-5s2.2-5 4.9-5c1.5 0 2.6.6 3.2 1.2l2.2-2.1C16 5.4 14.2 4.5 12 4.5 7.9 4.5 4.6 7.8 4.6 12s3.3 7.5 7.4 7.5c4.3 0 7.1-3 7.1-7.2 0-.5-.1-.9-.1-1.3H12z"/>
                  </svg>
                )}
                Continue with Google
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/[0.08]" /></div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or sign in with email</span>
                </div>
              </div>
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
              <Button type="submit" variant="glow" className="w-full" disabled={loading || !!demoLoading || googleLoading}>
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
          ) : (
          <form onSubmit={handleStudentSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-id">Student ID</Label>
                <Input
                  id="student-id"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                  placeholder="SUN-482917"
                  required
                  autoComplete="username"
                  className="bg-white/[0.04] border-white/[0.1] focus:border-primary/50 transition-colors font-mono tracking-wider"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-password">Password</Label>
                <Input
                  id="student-password"
                  type="password"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="Same as Student ID by default"
                  autoComplete="current-password"
                  className="bg-white/[0.04] border-white/[0.1] focus:border-primary/50 transition-colors"
                />
                <p className="text-xs text-muted-foreground">Leave blank to use your ID as the password.</p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" variant="glow" className="w-full" disabled={studentLoading}>
                {studentLoading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Signing in…</span>
                ) : 'Sign In as Student'}
              </Button>
            </CardFooter>
          </form>
          )}
        </Card>

        {/* Demo Logins */}
        <Card className="glass-panel border-white/[0.12]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-gold animate-pulse-glow" />
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
