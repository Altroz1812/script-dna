
## What's actually wrong

Two independent bugs combine to throw users into **/unauthorized** right after login or on refresh:

### Bug 1 — Race in `ProtectedRoute` for `admin / support / teacher`
`src/components/auth/ProtectedRoute.tsx` redirects to `/unauthorized` whenever:
```
role ∈ [admin, support, teacher] && !orgsLoading && availableOrgs.length === 0
```
But `ActiveOrgContext` updates state in this order on sign-in / refresh:
1. Previous session ends → `availableOrgs=[]`, `orgsLoading=false`.
2. New profile loads → ProtectedRoute re-renders **before** ActiveOrg's `useEffect` fires.
3. In that single render: `orgsLoading=false` (stale), `availableOrgs=[]` → ProtectedRoute fires `<Navigate to="/unauthorized" />`.
4. Once on `/unauthorized`, the gate keeps firing on every refresh because the route is also "protected" indirectly (Unauthorized page never recovers — there is no auto-redirect back when orgs eventually load).

This affects **every admin / teacher / support login**, intermittently. It also affects refresh because the same render order repeats.

### Bug 2 — Demo accounts with no org membership
DB check on `@demo.com` accounts:
```
admin       2 orgs
teacher     1 org
student     1 org
support     0 orgs  ← causes legitimate (not racy) Access Denied
parent      0 orgs  (parent is not org-required, so OK)
superadmin  0 orgs  (handled via Global view, OK)
```
`support@demo.com` genuinely has no org and no `profiles.organization_id`, so it correctly fails the gate — but the result is a dead-end "Access Denied" page with no recovery.

---

## Fix

### 1. `src/components/auth/ProtectedRoute.tsx`
- Track when the org list has actually been resolved **for the current user** (not just `!orgsLoading`). Treat the state as "not ready" until `ActiveOrgContext` has run its load effect for `session.user.id`.
- While org state is not ready → show the same spinner used for `(session && !profile)`. Do not redirect.
- Only after org state is ready, apply the existing "no org → unauthorized" rule.

### 2. `src/contexts/ActiveOrgContext.tsx`
- Add an internal `orgsLoadedForUserId` (ref or state). Reset to `null` when session changes; set to `session.user.id` only after a successful fetch.
- Expose it (or a derived `orgsReady` boolean) via the context so `ProtectedRoute` can gate on it.
- Keep `orgsLoading` initialised to `true` whenever a new user id arrives, even before the effect's first `await` (eliminates the stale-`false` window).

### 3. `src/pages/Unauthorized.tsx`
- When `location.state.reason === 'no-organization'`, render a clearer message: "Your account isn't linked to an organization yet. Contact your administrator." and show a **Sign out** button instead of "Go to Dashboard" (current button just loops back through the gate).
- Otherwise keep current copy.

### 4. Data fix migration — assign `support@demo.com` to an org
New migration that inserts an `organization_members` row + sets `profiles.organization_id` for `support@demo.com` (using the same org as `admin@demo.com`, "Bright Future" per the demo login map, or `Sunrise Academy` if Bright Future doesn't exist — query by name with a fallback).

No schema change, no RLS change.

---

## Files touched
- `src/components/auth/ProtectedRoute.tsx` — gate on `orgsReady`.
- `src/contexts/ActiveOrgContext.tsx` — add `orgsReady` flag, fix stale-`orgsLoading` window.
- `src/pages/Unauthorized.tsx` — better empty-org messaging + Sign out CTA.
- `supabase/migrations/<new>.sql` — seed support@demo.com membership.

## What we are NOT changing
- RLS policies (verified `organization_members` policies allow self-read).
- Login flow itself (`AuthContext`, `Login.tsx`) — they're correct.
- Mobile vs web logic — the fix is in shared `ProtectedRoute`, so both surfaces benefit.

## How we'll verify
1. Hard refresh as `admin@demo.com` (2 orgs) and `teacher@demo.com` (1 org) — should never flash `/unauthorized`; admin lands on `/select-organization`, teacher auto-selects and lands on `/dashboard`.
2. Login as `support@demo.com` after migration — lands on `/dashboard` (org auto-selected). Without migration would show the new friendly empty-state.
3. Login as `student@demo.com` / `parent@demo.com` — unaffected.
