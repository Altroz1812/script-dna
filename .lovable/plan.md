# Fix: Minimize leaves class instead of minimizing

## Problem

Clicking the Minimize button in a live class exits the class entirely. No minimized pill appears.

## Root cause

The project already has a global minimize system:
- `ClassroomSessionProvider` (mounted in `src/App.tsx`)
- `GlobalClassroomOverlay` (mounted in both desktop and mobile shells via `src/components/layout/AppLayout.tsx`) — renders the full-screen classroom when a session exists, and a minimized floating pill (with Expand / Leave buttons) when `minimized` is true.

But `LiveClassesPage` and `MobileLiveClassesPage` ignore this system. They render their **own** local `<VideoClassroom>` and wire:
- Desktop (`src/pages/LiveClassesPage.tsx` line 455): `onMinimize={handleCloseClass}` — minimize literally calls close, dropping the session.
- Mobile (`src/pages/mobile/MobileLiveClassesPage.tsx`): `onMinimize={() => {}}` — minimize is a no-op (and there is no minimized UI either).

Result: pressing Minimize either disconnects you (desktop) or does nothing (mobile).

## Fix

Delegate joining to the global classroom session so the existing overlay + minimized pill take over.

### 1. `src/pages/LiveClassesPage.tsx`
- Import `useClassroomSession`.
- Remove local `activeJoinedClassId` state, the fixed `<VideoClassroom>` block (lines ~444–470), and the `currentLiveClass` derivation that drove it.
- `handleJoinClass(cls)` calls `joinClass({ classId, roomName: edu-room-${id}, displayName, isTeacher, classStatus })` instead of setting local state.
- Drop the "skip the currently joined class" filter in `categorizedClasses` (or keep it by reading `session?.classId` from the context) — minor; the card just hides itself while you're in the room.
- Keep `EndClassAttendanceDialog` triggered by the existing End button in the global overlay header (no change needed there — the global overlay already exposes its own X/Minimize; the End-attendance dialog stays page-local and is opened from the live-class card's manage actions, unchanged).

### 2. `src/pages/mobile/MobileLiveClassesPage.tsx`
- Same change: import `useClassroomSession`, remove the local full-screen `<VideoClassroom>` block and `activeId` state, route the Join button to `joinClass(...)`.
- This automatically gives mobile users a working minimized pill (rendered by `GlobalClassroomOverlay`, already mounted in `MobileAppShell` through `AppLayout`).

### 3. Verify `GlobalClassroomOverlay` minimize works
The overlay already implements minimize correctly: when `minimized` is true it hides the full-screen panel (invisible + pointer-events-none, keeping the LiveKit connection alive) and shows a floating pill with Expand and Leave. No changes needed there.

## Files touched

- `src/pages/LiveClassesPage.tsx` — remove local VideoClassroom render, use `useClassroomSession().joinClass`.
- `src/pages/mobile/MobileLiveClassesPage.tsx` — same.

No other files change. `GlobalClassroomOverlay`, `ClassroomSessionContext`, `VideoClassroom`, and the End-class dialog all stay as-is.

## Verification

1. Desktop: Start/Join a live class → click Minimize → full-screen collapses, floating "Class in progress" pill appears bottom-right, you can navigate the app, click Expand to come back.
2. Mobile: Same flow — Minimize collapses the room and shows the pill; tapping it reopens the room with the LiveKit session intact.
3. Clicking X (Leave) in either the overlay header or pill ends the session as before.
