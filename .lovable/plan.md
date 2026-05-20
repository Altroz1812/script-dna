# Prevent Page Reinitialization on Resume

When the user switches tabs / apps and returns, the current page reloads its data, the classroom reconnects, and local state appears to reset. Root causes: React Query's default `refetchOnWindowFocus`/`refetchOnReconnect`, an aggressive `refetchInterval`, and the auth provider flipping `loading=true` on every `onAuthStateChange` event (including `TOKEN_REFRESHED` fired on focus), which unmounts protected routes.

## Changes

### 1. Global React Query defaults — `src/App.tsx`
Configure the shared `QueryClient` with safe defaults so every page inherits them:
```ts
new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 60_000,
      retry: 1,
    },
  },
})
```
This single change kills the bulk of the "everything reloads on resume" behavior across Dashboard, Schedule, Courses, Student/Parent pages, etc.

### 2. Stop auth-driven remounts — `src/contexts/AuthContext.tsx`
- Do **not** set `loading=true` inside `onAuthStateChange`. Only set it on the initial `getSession()` pass.
- Ignore `TOKEN_REFRESHED` and `INITIAL_SESSION` events for profile reload — only react to `SIGNED_IN` (when user id actually changes) and `SIGNED_OUT`.
- Keep the existing `setTimeout(0)` deadlock guard.

Effect: `ProtectedRoute` no longer briefly renders its loader on tab return, so the `<Outlet/>` tree (and the page component) is not unmounted.

### 3. Tame the classroom hook — `src/hooks/useTodayClasses.ts`
- Replace `refetchInterval: 30s` with `refetchInterval: 60s` and add `refetchIntervalInBackground: false` so polling pauses when hidden and doesn't fire a burst on resume.
- Explicitly set `refetchOnWindowFocus: false`.

### 4. Keep the LiveKit session alive
`GlobalClassroomOverlay` already lives in `AppLayout` and stays mounted while routes change, so the LiveKit room will no longer be torn down once items 1–2 above stop the layout from remounting. No structural change needed here — verify only.

### 5. Light visibility audit
- `src/pages/ActivityLogsPage.tsx` and `src/pages/SchedulePage.tsx` use raw `setInterval` for polling. Gate them with `document.visibilityState === 'visible'` inside the tick so hidden tabs don't queue work that floods on resume. No refetch on focus is added.

## Out of scope
- No changes to LiveKit reconnect logic itself (LiveKit handles its own resume).
- No router/layout restructuring — the existing `AppLayout` already persists across route changes; the fix is to stop the auth context from forcing it to unmount.
- Form/scroll state is preserved automatically once remounts stop; no per-page work needed.

## Verification
1. Open Dashboard, switch tabs for 30s, return → no network burst, no skeleton flash.
2. Join a live class, minimize, switch to another app, return → still connected, no reconnect.
3. Fill a form, switch tabs, return → inputs intact.
