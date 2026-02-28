import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isRoleAtLeast } from '@/lib/rbac';
import type { AppRole } from '@/types/roles';

export function useRBAC() {
  const { profile } = useAuth();
  const role = profile?.role ?? null;

  const hasRole = useCallback(
    (r: AppRole) => role === r,
    [role],
  );

  const hasMinRole = useCallback(
    (minRole: AppRole) => (role ? isRoleAtLeast(role, minRole) : false),
    [role],
  );

  const canAccess = useCallback(
    (allowed: AppRole[]) => (role ? allowed.includes(role) : false),
    [role],
  );

  const isAdmin = useMemo(() => role === 'superadmin' || role === 'admin', [role]);
  const isSuperAdmin = useMemo(() => role === 'superadmin', [role]);

  return { role, hasRole, hasMinRole, canAccess, isAdmin, isSuperAdmin };
}
