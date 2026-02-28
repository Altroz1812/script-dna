import type { ReactNode } from 'react';
import { useRBAC } from '@/hooks/useRBAC';
import type { AppRole } from '@/types/roles';

interface RequireRoleProps {
  roles: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ roles, children, fallback = null }: RequireRoleProps) {
  const { canAccess } = useRBAC();
  return canAccess(roles) ? <>{children}</> : <>{fallback}</>;
}
