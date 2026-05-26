import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const reason = (location.state as any)?.reason as string | undefined;
  const noOrg = reason === 'no-organization';

  const handleSignOut = async () => {
    try { await signOut(); } finally { navigate('/login', { replace: true }); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4 text-center">
      {noOrg ? (
        <Building2 className="h-16 w-16 text-primary" />
      ) : (
        <ShieldAlert className="h-16 w-16 text-destructive" />
      )}
      <h1 className="text-2xl font-bold text-foreground">
        {noOrg ? 'No organization linked' : 'Access Denied'}
      </h1>
      <p className="text-muted-foreground max-w-md">
        {noOrg
          ? "Your account isn't linked to an organization yet. Please contact your administrator to be added before signing in."
          : "You don't have permission to access this page. Contact your administrator if you believe this is a mistake."}
      </p>
      <div className="flex gap-2">
        {noOrg ? (
          <Button onClick={handleSignOut} variant="outline">Sign out</Button>
        ) : (
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        )}
      </div>
    </div>
  );
}
