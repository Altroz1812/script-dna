import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveOrg } from '@/contexts/ActiveOrgContext';
import type { AppRole } from '@/types/roles';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();
  const { activeOrgId } = useActiveOrg();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // SuperAdmin must pick an organization (or Global) before entering the app.
  if (
    profile?.role === 'superadmin' &&
    activeOrgId === undefined &&
    location.pathname !== '/select-organization'
  ) {
    return <Navigate to="/select-organization" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
