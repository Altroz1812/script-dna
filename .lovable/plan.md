

# Supabase Authentication Integration -- Gap Analysis and Completion Plan

## What Already Exists (No Changes Needed)

| Requirement | Status | Location |
|---|---|---|
| Email/password login | Done | `authService.signIn()`, `Login.tsx` |
| Email/password signup | Done | `authService.signUp()`, `Signup.tsx` |
| JWT session handling | Done | Supabase client with `persistSession: true` |
| Session persistence | Done | `localStorage` storage in Supabase client config |
| Refresh token handling | Done | `autoRefreshToken: true` in Supabase client config |
| Logout | Done | `authService.signOut()`, `AppHeader.tsx` dropdown |
| Protected routes | Done | `ProtectedRoute` component with role checks |
| Role in separate table | Done | `user_roles` table with `app_role` enum |
| Auth state listener | Done | `onAuthStateChange` set up before `getSession()` |
| Profile auto-creation | Done | `handle_new_user` trigger on `auth.users` |
| Default role assignment | Done | `handle_new_user_role` trigger assigns `student` |
| Password reset flow | Done | `ForgotPassword.tsx` + `ResetPassword.tsx` |
| Role-based navigation | Done | `getNavigationForRole()` in `navigation.ts` |

## What's Missing -- RBAC Guard Utilities

The core auth works, but there are no reusable RBAC helper functions or hooks for use across components. This plan adds them.

### 1. Create `src/hooks/useRBAC.ts`

A hook that provides role-checking utilities derived from the current user's profile:

- **`hasRole(role)`** -- checks if user has exactly this role
- **`hasMinRole(role)`** -- checks if user's role is at or above a given level in the hierarchy (superadmin > admin > teacher > student > parent)
- **`canAccess(allowedRoles[])`** -- checks if user's role is in the provided list
- **`isAdmin`** -- shorthand for superadmin or admin
- **`isSuperAdmin`** -- shorthand for superadmin only

### 2. Create `src/components/auth/RequireRole.tsx`

An inline component for conditionally rendering UI based on role:

```text
<RequireRole roles={['superadmin', 'admin']}>
  <AdminOnlyButton />
</RequireRole>
```

Accepts an optional `fallback` prop (defaults to `null`).

### 3. Create `src/lib/rbac.ts`

Pure utility functions (no React dependency) for role logic:

- `isRoleAtLeast(userRole, minimumRole)` -- compares against `ROLE_HIERARCHY`
- `filterByRole(items, userRole)` -- filters arrays of items that have a `roles` property

These are extracted so they can be reused in non-component contexts (e.g., services, tests).

---

## Technical Details

### File changes summary

| Action | File |
|---|---|
| Create | `src/lib/rbac.ts` |
| Create | `src/hooks/useRBAC.ts` |
| Create | `src/components/auth/RequireRole.tsx` |

No database changes, no new dependencies, no migration needed. All three files are pure frontend utilities that build on top of the existing `AuthContext` and `roles.ts` types.

