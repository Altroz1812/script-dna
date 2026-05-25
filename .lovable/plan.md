## Goal

Deliver a native-app feel for AuraPen on iOS/Android (via Capacitor) and small viewports, without touching the existing desktop experience. First pass = navigation shell + 4 role homes + reusable mobile UI primitives. Haptics/offline deferred.

## Activation strategy

A new `useIsMobileApp()` hook returns true when **either**:
- `window.matchMedia('(max-width: 767px)').matches`, or
- Capacitor is detected (`window.Capacitor?.isNativePlatform?.()`).

`AppLayout.tsx` branches: mobile → `<MobileAppShell />`, desktop → existing sidebar layout. `GlobalClassroomOverlay` stays mounted in both.

## Navigation shell

`src/components/mobile/MobileAppShell.tsx`
- Sticky top bar: hamburger (opens drawer), centered page title, right-side notifications bell.
- `<Outlet />` in a scroll container with safe-area padding (`env(safe-area-inset-*)`).
- Sticky bottom tab bar (`fixed bottom-0`, `h-16`, blurred glass): **Home · Courses · Classes · Profile**. Active tab shows gradient pill + label; 44px touch targets; `active:scale-95` press feedback; 180ms transitions.
- Routes map by role:
  - Home → `/dashboard`
  - Courses → student/parent: `/courses`; teacher/admin: `/batches`
  - Classes → `/live-classes`
  - Profile → `/profile`
- Sub-pages show a back chevron in the top bar (uses `navigate(-1)`).

`src/components/mobile/MobileDrawer.tsx`
- Slide-in left drawer (use existing `Sheet`/`Drawer` primitive), grouped sections built from `src/config/navigation.ts` filtered by role.
- Header: user avatar, name, role badge, active org chip.
- Footer: theme toggle + Sign out.

## Role home dashboards

New `src/pages/mobile/` directory. `Dashboard.tsx` detects mobile and renders the role-specific home; desktop dashboard unchanged.

1. **StudentHome** — Greeting, large circular progress ring (overall completion), "Today's Classes" horizontal scroller, quick-action grid (Practice, Submit, Materials, Progress), Recent Submissions list.
2. **TeacherHome** — Stat tiles (Active batches, Today's classes, Pending reviews), Live-class indicator banner (pulses when a class is live), Pending submissions list, floating FAB (bottom-right above tab bar) → quick-create menu (New Class, New Assignment).
3. **AdminHome** — Revenue card (₹ today/this month, sparkline), user stats grid (Students, Teachers, Active orgs), quick actions, Activity feed from `activity_logs`.
4. **ParentHome** — Children list cards with mini progress bars, Upcoming classes section, Payments summary.

All cards reuse existing AuraPen tokens (glassmorphism, gradient accents) — no new design system.

## Reusable mobile UI primitives

Under `src/components/mobile/ui/`:
- `MobilePage.tsx` — wrapper that sets title via context, applies pull-to-refresh.
- `PullToRefresh.tsx` — touch-based, CSS transform spring-back, calls a passed `onRefresh` (returns Promise).
- `Shimmer.tsx` — skeleton variants: card, list-row, stat-tile, ring. Used during data fetch so screens never blank-flash.
- `EmptyState.tsx` — icon + headline + helper + optional CTA.
- `ErrorState.tsx` — icon + message + retry button.
- `TouchPress.tsx` — wrapper adding `active:scale-[0.97] transition-transform duration-150` + role="button".
- `OfflineBanner.tsx` — placeholder that listens to `navigator.onLine` (true offline cache lands next pass).
- `FAB.tsx` — floating action button positioned above the tab bar.

All animations capped at 200ms.

## Capacitor alignment

- No new native plugins this pass (haptics deferred).
- `index.html` viewport already includes `viewport-fit=cover`; verify and add safe-area CSS vars in `index.css`.
- Bottom tab bar respects `env(safe-area-inset-bottom)`; top bar respects `env(safe-area-inset-top)`.
- Status bar styling left to existing Capacitor config.

## Performance guardrails

- Mobile shell + pages are code-split via `React.lazy` so desktop bundle is unaffected.
- Reuse existing React Query caches — homes call the same hooks the current dashboard already uses (e.g. `useTodayClasses`, dashboard `getStats` RPC). No new network calls beyond what already runs.
- Shimmer renders for max 1 frame when cached; cached-first via existing localStorage dashboard cache.

## Out of scope (next pass)

- Haptics (`@capacitor/haptics`), offline cache (`@capacitor/network` + React Query persistence).
- Native treatment of secondary pages (Materials, Payments, Reports, etc.) — they render inside the mobile shell but keep current responsive layout.
- iOS vs Android platform-adaptive styling (unified AuraPen look chosen).

## Files

New:
- `src/hooks/useIsMobileApp.ts`
- `src/components/mobile/MobileAppShell.tsx`
- `src/components/mobile/MobileTopBar.tsx`
- `src/components/mobile/MobileBottomTabs.tsx`
- `src/components/mobile/MobileDrawer.tsx`
- `src/components/mobile/ui/{MobilePage,PullToRefresh,Shimmer,EmptyState,ErrorState,TouchPress,OfflineBanner,FAB}.tsx`
- `src/pages/mobile/{StudentHome,TeacherHome,AdminHome,ParentHome}.tsx`

Edited:
- `src/components/layout/AppLayout.tsx` — branch on `useIsMobileApp()`.
- `src/pages/Dashboard.tsx` — render role home on mobile.
- `src/index.css` — safe-area CSS vars + a few mobile utilities.
