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
  const { activeOrgId, availableOrgs, orgsLoading } = useActiveOrg();
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

  // Multi-org roles (admin / support / teacher) MUST belong to at least one
  // organization. If they have zero memberships we send them to /unauthorized
  // instead of falling through to a possibly unfiltered view.
  const orgRequiredRoles: AppRole[] = ['admin', 'support', 'teacher'];
  if (
    profile &&
    orgRequiredRoles.includes(profile.role) &&
    !orgsLoading &&
    availableOrgs.length === 0 &&
    location.pathname !== '/unauthorized'
  ) {
    return <Navigate to="/unauthorized" replace state={{ reason: 'no-organization' }} />;
  }

  // Tenant scoping gate:
  //  - SuperAdmin must always pick (or hit Global) before entering.
  //  - Other roles only need to pick when they belong to multiple orgs.
  const needsPicker =
    profile &&
    location.pathname !== '/select-organization' &&
    activeOrgId === undefined &&
    !orgsLoading &&
    (profile.role === 'superadmin' || availableOrgs.length > 1);
  if (needsPicker) {
    return <Navigate to="/select-organization" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
