# Native mobile fullscreen video classroom

## Goal
On mobile, the live class must take over the whole screen with all controls accessible, the host (or active screen-share) always occupies the main stage, and other participants render as small chromeless tiles — no card frames around any participant.

## Changes

### 1. `src/pages/mobile/MobileLiveClassesPage.tsx` — render the active class as a fullscreen overlay
- Remove the in-page `aspect-video` card wrapper around `<VideoClassroom>`.
- When `activeClass` exists, render `<VideoClassroom>` inside a `fixed inset-0 z-[100] bg-black` container that respects safe-area insets (`env(safe-area-inset-top/bottom)`).
- Move the "End Session" button into a small floating action pinned to the top-right of the overlay (so all LiveKit controls remain reachable at the bottom).
- Keep the list view rendering underneath; the overlay simply covers it while a class is active.

### 2. `src/components/classroom/VideoClassroom.tsx` — make the shell mobile-fullscreen friendly
- Container already uses `w-full h-full` — verified compatible with the new fullscreen parent.
- Replace `ClassroomStage` (currently a `GridLayout` of `ParticipantTile`) with a new `FocusedStage` component (below) so the host/screen-share is the focal point and others are pip-style tiles.
- On mobile, render `ClassroomChat` as a bottom sheet (`inset-x-0 bottom-0 h-[70vh] rounded-t-2xl`) instead of a right-side panel, so it overlays the video without squeezing it.

### 3. New focused stage layout (inside `VideoClassroom.tsx`)
Replace `ClassroomStage` with `FocusedStage`:

- Use `useTracks([Camera with placeholder, ScreenShare])` and additionally `useParticipants()` to know who's the teacher (moderator metadata from `useParticipantRole`).
- Pick the **main track** with this priority:
  1. Any active `ScreenShare` track → main stage shows the projection.
  2. Else the teacher/moderator's camera track → host on max screen.
  3. Else the local participant's camera as fallback.
- Render the main track full-bleed (`absolute inset-0 object-cover`, no border, no rounded card, no name overlay box — just a subtle gradient-bottom name label).
- Render every other participant as small **chromeless** floating tiles in a horizontal strip at the top-right (or bottom-left above the control bar): plain `<video>` element wrapped in a `rounded-xl overflow-hidden w-20 h-28` div, no card background, no border ring except a thin `ring-1 ring-white/10` for separation. Mic-muted indicator is a tiny icon corner-pinned.
- When screen-share is the main stage, the host's camera becomes one of the floating tiles (pinned first), satisfying "when projected it's rendered in the card".
- No `<Card>` / `ParticipantTile` chrome anywhere — strictly plain video elements with minimal overlays.

### 4. Controls remain available
- Keep `<RoleAwareControls>` rendered at the bottom of the fullscreen stage (it already exposes mic / camera / screenshare / leave for moderators and Leave for viewers).
- Header bar (chat, minimize, close buttons) stays at the top inside the safe area.

## Technical notes
- Use `useParticipants` and `useTracks` from `@livekit/components-react`; attach tracks manually with `<VideoTrack trackRef={…} />` (or the `useTrackRefContext`-free `<ParticipantTile disableSpeakingIndicator>` styled to remove its chrome via `[&_.lk-participant-metadata]:hidden [&]:bg-transparent [&]:border-0`).
- No backend, RLS, or schema changes.
- Desktop behavior is preserved because the fullscreen overlay is only applied in the mobile page wrapper; the existing `GlobalClassroomOverlay` (desktop) continues using its current layout, but it will inherit the new `FocusedStage` — which is the desired UX on desktop too (host max, participants chromeless).

## Files touched
- `src/pages/mobile/MobileLiveClassesPage.tsx`
- `src/components/classroom/VideoClassroom.tsx`
