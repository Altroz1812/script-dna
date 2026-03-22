

## LiveKit Integration Plan for Live Video Classes

### Current State
The live classes UI is **fully built** with:
- `LiveClassesPage.tsx` — dashboard with calendar, filters, summary cards, class lifecycle (Start/End)
- `VideoClassroom.tsx` — currently uses Jitsi Meet via iframe embed
- `EndClassAttendanceDialog.tsx` — attendance marking on class end
- Database: `live_classes` table with status transitions, auto-creation from schedules

The only piece to replace is the **video transport layer** (Jitsi iframe → LiveKit SDK).

---

### Step 0: Set Up a LiveKit Server

You need a LiveKit server before we can integrate. Two options:

**Option A — LiveKit Cloud (recommended, fastest)**
1. Go to https://cloud.livekit.io and create a free account
2. Create a new project — you get a **WebSocket URL**, **API Key**, and **API Secret**
3. Free tier includes 50 participant-minutes/month for testing

**Option B — Self-hosted**
1. Deploy LiveKit on a VPS (Docker one-liner): `docker run -d -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev`
2. Generate API key/secret via `livekit-server generate-keys`
3. For production, use a domain with TLS

Once you have the three values (URL, API Key, API Secret), let me know and we proceed.

---

### Step 1: Store LiveKit Secrets
- Add three secrets via the secrets tool:
  - `LIVEKIT_URL` (e.g., `wss://your-project.livekit.cloud`)
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`

### Step 2: Create `livekit-token` Edge Function
A backend function that generates short-lived JWT access tokens for participants.

- **Input**: `roomName`, `participantName`, `participantIdentity`, role info
- **Logic**: Uses LiveKit Server SDK (`livekit-server-sdk`) to create a token with grants:
  - Teachers get `canPublish: true, canSubscribe: true, roomAdmin: true`
  - Students get `canPublish: true, canSubscribe: true` (mic/camera for interaction)
- **Output**: `{ token: "..." }`
- Called from the frontend before joining a room

### Step 3: Install LiveKit React SDK (Frontend)
- Add `livekit-client` and `@livekit/components-react` npm packages
- These provide pre-built React components: `LiveKitRoom`, `VideoConference`, `ParticipantTile`, `ControlBar`

### Step 4: Replace `VideoClassroom.tsx`
Replace the Jitsi iframe with a native LiveKit component:

```text
VideoClassroom (updated)
├── Calls edge function to get LiveKit token
├── <LiveKitRoom serverUrl={...} token={...}>
│   ├── <VideoConference />  ← handles video grid, controls, screen share
│   └── Teacher-only controls (mute all, kick, etc.)
└── Fullscreen toggle + close button (keep existing)
```

- On mount: fetch token from `livekit-token` edge function
- Pass token + LiveKit URL to `<LiveKitRoom>`
- Use `<VideoConference />` for the full UI (video grid + controls) or compose custom layout with `<ParticipantTile>` components
- Teacher role detection passed as prop to show admin controls

### Step 5: Update `LiveClassesPage.tsx` (Minimal Changes)
- When "Start" is pressed: instead of storing a Jitsi URL, store a room name (e.g., `class-{id}`)
- When "Join" is pressed: open VideoClassroom with room name + user identity
- The `meeting_url` field becomes the LiveKit room name (or stays null — room name derived from class ID)
- No other changes needed — the class lifecycle, calendar, filters all stay the same

### Files to Create/Modify
| File | Action |
|------|--------|
| `supabase/functions/livekit-token/index.ts` | **Create** — token generation endpoint |
| `src/components/classroom/VideoClassroom.tsx` | **Rewrite** — LiveKit SDK instead of Jitsi iframe |
| `src/pages/LiveClassesPage.tsx` | **Minor edit** — remove Jitsi URL references |

### What Stays Unchanged
- Live classes dashboard layout, summary cards, calendar
- Class lifecycle (scheduled → live → completed)
- EndClassAttendanceDialog and attendance flow
- Database schema — no migrations needed
- RBAC and role-based button visibility

---

### Next Step
Set up your LiveKit Cloud account at https://cloud.livekit.io and share the three values (URL, API Key, API Secret) so I can proceed with implementation.

