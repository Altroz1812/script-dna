import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4 text-center">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
      <p className="text-muted-foreground max-w-md">
        You don't have permission to access this page. Contact your administrator if you believe this is a mistake.
      </p>
      <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
    </div>
  );
}
