

## Add In-Class Chat Panel

### Overview
Add a toggleable chat panel inside the video classroom that uses LiveKit's built-in data channel for real-time text messaging between all participants. No database tables or new edge functions needed — messages are ephemeral and transmitted via the existing WebRTC connection.

### Architecture

```text
VideoClassroom
├── Header (existing) + Chat toggle button
├── Content area (flex row)
│   ├── Video area (flex-1)
│   │   ├── <VideoConference />
│   │   └── Teacher/Student controls
│   └── Chat panel (w-80, collapsible)
│       ├── Message list (ScrollArea)
│       └── Input + Send button
```

### Implementation

**1. Create `src/components/classroom/ClassroomChat.tsx`**
- Uses `useRoomContext()` from LiveKit to access the room
- Sends messages via `room.localParticipant.publishData()` with a JSON payload: `{ type: 'chat', sender, message, timestamp }`
- Listens for incoming messages via `RoomEvent.DataReceived`
- Maintains local message state (array of `{ sender, message, timestamp }`)
- Auto-scrolls to latest message
- Input field with Enter-to-send and a Send button

**2. Update `src/components/classroom/VideoClassroom.tsx`**
- Add a `MessageSquare` toggle button in the header bar
- Add `chatOpen` state
- Wrap the video + chat in a flex row layout
- Conditionally render `<ClassroomChat />` inside `<LiveKitRoom>` when panel is open
- Show unread message count badge on the toggle button

**3. Update `src/components/classroom/StudentDataListener.tsx`**
- Filter out messages with `type: 'chat'` so they don't trigger control actions (mute/kick)

### Technical Details
- Messages use LiveKit data channels (reliable mode) — zero latency, no server storage
- Chat messages are distinguished from teacher control messages by a `type: 'chat'` field in the JSON payload
- The StudentDataListener already has a try/catch for non-JSON; we add a check to skip `type === 'chat'` messages

### Files
| File | Action |
|------|--------|
| `src/components/classroom/ClassroomChat.tsx` | **Create** |
| `src/components/classroom/VideoClassroom.tsx` | **Update** — add toggle + layout |
| `src/components/classroom/StudentDataListener.tsx` | **Update** — ignore chat messages |

