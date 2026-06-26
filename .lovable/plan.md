
# Mobile-First Overhaul

A systematic, page-by-page mobile-first pass across the entire AuraPen app — covering Student, Parent, Teacher, Admin, and SuperAdmin surfaces. Desktop layouts remain intact; we redesign the mobile/tablet experience underneath.

## Goals

- Every page usable one-handed on a 360–430px screen
- No horizontal scroll, no clipped controls, no hidden actions
- Tap targets ≥ 44px, sticky primary CTAs, safe-area aware
- Tables become cards; dialogs become bottom sheets; charts scroll/stack
- Consistent mobile shell (header + bottom nav + drawer) across roles

## Foundation (shared, built first)

1. **Responsive shell**
   - Unified `MobileAppShell`: sticky top bar (logo, org switcher, profile), bottom tab nav per role, slide-in drawer for secondary menu, safe-area insets (`env(safe-area-inset-*)`).
   - Role-aware bottom nav configs (Student / Parent / Teacher / Admin) — 4–5 primary items + "More".
   - Persistent FAB slot for context actions (e.g. "+ Assignment", "+ Lead").

2. **Reusable mobile primitives** in `src/components/mobile/`
   - `ResponsiveTable` — renders shadcn `Table` on ≥md, stacked `Card` list on <md, with row actions in a `DropdownMenu`/swipe.
   - `ResponsiveDialog` — `Dialog` on desktop, `Sheet` (bottom, full-height, snap points) on mobile, with sticky footer CTAs and keyboard-safe scroll area.
   - `ResponsiveForm` — single-column on mobile, larger inputs (h-12), floating labels, sticky submit bar above the keyboard.
   - `MetricCard` + `MetricCarousel` — horizontal snap scroller for dashboards on mobile, grid on desktop.
   - `ChartFrame` — wraps Recharts in a horizontally scrollable, min-width container; legend collapses to a sheet.
   - `PageHeader` — title, breadcrumb collapse, overflow menu for actions on mobile.

3. **Design tokens & utilities**
   - Add mobile spacing scale, tap-target utility (`min-h-11 min-w-11`), `safe-top`/`safe-bottom` classes in `index.css`.
   - Audit and remove hardcoded widths/`overflow-x` issues globally.

## Page-by-page redesign

Grouped by role; each page gets: mobile layout, table→card conversion, dialog→sheet, sticky CTA, empty/loading skeletons.

### Student & Parent
- Dashboard (metrics carousel, today's class banner, next assignment)
- My Progress + Certificates tab (card list, view/download in sheet)
- Assignments (list with status chips, submit sheet)
- Live Classes (join card, pre-join sheet)
- Parent → Children switcher, per-child progress

### Teacher
- Dashboard (today's sessions, pending approvals carousel)
- Batches list + Batch detail (tabs become segmented control; student roster as cards; attendance as tap-to-toggle list; "Mark Completed" sticky CTA)
- Practice Assignments (module/lesson dropdowns in sheet, file preview)
- Live Classes (mobile control bar already fixed — extend to roster sheet, permissions sheet)
- Certificates issuance (bulk select with sticky action bar)

### Admin / SuperAdmin
- Dashboard (metric carousel + drill-down sheet)
- Leads (card list, payment tab inside sheet, approve flow as multi-step sheet)
- Users / Roles & Permissions (card list, org assignment sheet, role chips)
- Payments (card list, filters in sheet)
- Organizations (Select Org page already mobile-tuned; extend Add/Edit form into full-screen sheet with sections)
- Classroom Settings, System Monitoring (stacked sections, collapsible groups)
- Courses / Catalog / Auto-scheduling (wizard becomes step sheet)

### Auth & Checkout
- Login (Student ID / Email / Google tabs, larger inputs, sticky CTA)
- Checkout wizard (one step per screen on mobile, progress bar, sticky "Continue")
- Landing page (already cinematic — verify hero, branch filter chips horizontal scroll, sticky enroll CTA)

## Technical approach

- New folder `src/components/mobile/` for primitives.
- New `src/layouts/MobileAppShell.tsx` + `useIsMobile` hook (already exists — extend).
- Route-level layout switch: shared `AppLayout` picks `DesktopShell` vs `MobileAppShell` based on viewport, no route duplication.
- Convert existing `Dialog` usages to `ResponsiveDialog` via codemod-style search/replace, page by page.
- Tables migrated to `ResponsiveTable` per page (keeps column defs, adds `mobileCard` render prop).
- Recharts wrapped in `ChartFrame`; switch to `ResponsiveContainer` with min-width.
- Keyboard handling: `inputmode`, `enterkeyhint`, `visualViewport` listener for sticky footers.
- Test matrix per page on 360, 390, 430, 768 widths via Playwright screenshots.

## Rollout order

1. Foundation (shell + primitives + tokens) — 1 pass, no page changes yet
2. Student & Parent pages
3. Teacher pages
4. Admin / SuperAdmin pages
5. Auth, Checkout, Landing
6. Playwright sweep at 4 viewports per role; fix regressions

## Out of scope

- Desktop visual changes (untouched unless a shared component is refactored)
- Backend / business logic changes
- New features — this is purely presentation and layout
- Native Capacitor packaging (separate request)

## Diagram

```text
AppLayout
├── useIsMobile?
│    ├── DesktopShell (Sidebar + Topbar)   ← unchanged
│    └── MobileAppShell
│         ├── TopBar (logo, org, profile)
│         ├── <Outlet />  ← pages use mobile primitives
│         ├── FAB (contextual)
│         └── BottomNav (role-aware)
└── Primitives: ResponsiveTable | ResponsiveDialog | ResponsiveForm
                MetricCarousel | ChartFrame | PageHeader
```
