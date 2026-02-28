import { ROLE_HIERARCHY, type AppRole } from '@/types/roles';

export function isRoleAtLeast(userRole: AppRole, minimumRole: AppRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) <= ROLE_HIERARCHY.indexOf(minimumRole);
}

export function filterByRole<T extends { roles: AppRole[] }>(items: T[], userRole: AppRole): T[] {
  return items.filter((item) => item.roles.includes(userRole));
}
