import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<boolean | null>(null);
  const { toast } = useToast();

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFound(null);
    try {
      // Check if a profile exists with this email
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;

      setFound(!!data);
      if (!data) {
        toast({ title: 'Not found', description: 'No account found with this email address.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center">
          <CardTitle>{found ? 'Contact Your Administrator' : 'Forgot Password'}</CardTitle>
          <CardDescription>
            {found
              ? 'Your account was found. Please contact your admin or super admin to reset your password.'
              : 'Enter your email to check your account'}
          </CardDescription>
        </CardHeader>

        {found === null || found === false ? (
          <form onSubmit={handleCheck}>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Checking…' : 'Check Account'}
              </Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
                Back to sign in
              </Link>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-sm text-muted-foreground text-center">
                Account found for <strong>{email}</strong>
              </p>
              <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border border-border/50">
                <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  For security, password resets are handled by your <strong>Admin</strong> or <strong>Super Admin</strong>. Please reach out to them to reset your password.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={() => { setFound(null); setEmail(''); }}>
                Check another email
              </Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary text-center">
                Back to sign in
              </Link>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
