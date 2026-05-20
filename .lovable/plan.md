# Plan: Dashboard Class Cards + Full-Page Video Join

## Goals
1. Every role's dashboard shows two prominent cards: **Today's Class** (next class scheduled today) and **Live Now** (any class currently live).
2. Clicking either card joins immediately — no need to navigate to Live Classes page.
3. After successful join, the classroom renders as a **full-page overlay** (not a 500px embed) with **Close** and **Minimize** controls available to every participant (teacher, admin, student, parent).
4. Minimize collapses the video to a draggable corner pill (PiP-style) so users can still navigate the app; clicking it re-expands. Close disconnects and dismisses.

## Implementation

### 1. New shared hook + provider: `ClassroomSessionProvider`
- File: `src/contexts/ClassroomSessionContext.tsx`
- Holds global state for the currently-joined class: `{ classId, roomName, displayName, isTeacher, classStatus, minimized }`.
- Exposes `joinClass(cls)`, `leaveClass()`, `toggleMinimize()`.
- Mounted in `App.tsx` above the router so the overlay survives route changes.

### 2. New component: `GlobalClassroomOverlay`
- File: `src/components/classroom/GlobalClassroomOverlay.tsx`
- Reads from `ClassroomSessionContext`.
- When `classId` present and `!minimized`: renders `VideoClassroom` inside a `fixed inset-0 z-[100]` container (true full-page).
- When `minimized`: renders a floating pill at bottom-right (avatar + "Class in progress" + expand button + close button). Audio keeps playing because `LiveKitRoom` stays mounted (we hide via CSS `hidden` rather than unmount).
- Rendered once in `AppLayout.tsx`.

### 3. Update `VideoClassroom.tsx`
- Remove the internal `fullscreen` state and 500px embedded mode — it's always rendered inside the overlay container, so it fills its parent.
- Header gets two buttons for **all users**: **Minimize** (calls `toggleMinimize`) and **Close** (calls `leaveClass`). Drop the old maximize toggle.
- Keep existing connection / waiting-room / error UI.

### 4. Dashboard cards (`src/pages/Dashboard.tsx`)
Add a new top section (above existing stat grid) shown for **every role** when data is available:
- **Live Now card**: highlighted green/pulse if a class with `status='live'` exists; click → `joinClass(...)`. Empty state: "No class live right now".
- **Today's Class card**: shows next `scheduled` class today (earliest by `scheduled_at`); click → for teachers/admins triggers `startClass`+join, for students triggers join (waiting room handles pre-start). Empty state: "No class today".

Data source per role:
- Student/Parent: already fetched in `studentData.upcomingClasses` / `parentData.upcomingClasses` — filter by today/live.
- Teacher: already in `teacherData` — extend query to return the full list (currently only count).
- Admin/Superadmin/Support: add a new lightweight query `adminQuery('list_live_classes')` filtered to today + live, scoped by `effectiveOrgId`.

Extract a small reusable `<ClassQuickJoinCards classes={...} onJoin={...} onStart={...} />` component to avoid duplicating JSX across 5 role branches.

### 5. Wire join handlers
- The card's join calls `joinClass({ classId, roomName: meeting_url || 'class-'+id.slice(0,8), displayName, isTeacher, classStatus })`.
- For teachers/admins starting a not-yet-live class, call the same `startClass` flow already in `LiveClassesPage` — extract it into `src/services/classroom/startClass.ts` so dashboard + classes page share it.
- `LiveClassesPage` join buttons also switch to using `joinClass` from the context (drop its local `activeClassroom` state and the inline `VideoClassroom` mount).

### 6. Routing
No new routes. The overlay is global, so users can navigate while minimized.

## Technical Notes
- `LiveKitRoom` must stay mounted during minimize. Implement by toggling Tailwind `hidden` + sizing classes rather than unmounting; otherwise the media connection drops.
- `z-index`: overlay `z-[100]`, minimized pill `z-[90]`, both above sidebar.
- Mobile: full-page already responsive; minimized pill anchors `bottom-4 right-4`, ~`w-64`.
- No backend / schema / RLS changes.
- No new edge functions.

## Files Touched
- New: `src/contexts/ClassroomSessionContext.tsx`
- New: `src/components/classroom/GlobalClassroomOverlay.tsx`
- New: `src/components/classroom/ClassQuickJoinCards.tsx`
- New: `src/services/classroom/startClass.ts`
- Edit: `src/App.tsx` (wrap with provider)
- Edit: `src/components/layout/AppLayout.tsx` (mount overlay)
- Edit: `src/components/classroom/VideoClassroom.tsx` (header buttons, drop fullscreen toggle)
- Edit: `src/pages/Dashboard.tsx` (add quick-join cards in all role branches)
- Edit: `src/pages/LiveClassesPage.tsx` (use shared join context + startClass service)
