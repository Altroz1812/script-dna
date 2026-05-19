import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { sanitizeEmail, checkRateLimit, formatRetryTime, checkPasswordStrength } from '@/lib/security';
import aurapenLogo from '@/assets/aurapen-logo.png';

function getErrorMessage(err: any): string {
  const msg = err?.message ?? '';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return 'Network error — please check your connection and try again.';
  }
  if (msg.includes('already registered')) return 'This email is already registered. Try signing in instead.';
  return msg || 'Sign up failed. Please try again.';
}

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    const strength = checkPasswordStrength(password);
    if (strength.score < 2) {
      toast({ title: 'Weak password', description: 'Please choose a stronger password.', variant: 'destructive' });
      return;
    }

    const rateCheck = checkRateLimit(`signup:${cleanEmail}`);
    if (!rateCheck.allowed) {
      toast({ title: 'Too many attempts', description: `Try again in ${formatRetryTime(rateCheck.retryAfterMs)}.`, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await signUp(cleanEmail, password);
      toast({ title: 'Check your email', description: 'We sent you a verification link.' });
    } catch (err: any) {
      toast({ title: 'Sign up failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-gold/25 blur-xl" />
            <img src={aurapenLogo} alt="AuraPen" className="w-16 h-16 object-contain relative z-10" />
          </div>
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>Get started with AuraPen</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              <PasswordStrengthMeter password={password} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </span>
              ) : (
                'Sign Up'
              )}
            </Button>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
              Already have an account? Sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
