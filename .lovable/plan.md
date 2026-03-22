

## Improve Video Classroom Error Handling

### Problem
When LiveKit connection fails (e.g. server unreachable at `wss://class-e31h62p3.livekit.cloud`), users see a generic error or the UI hangs with no clear guidance.

### Changes

**Update `src/components/classroom/VideoClassroom.tsx`**

1. Add a **pre-connect WebSocket check** before rendering `<LiveKitRoom>` — after getting the token, test `new WebSocket(serverUrl)` with a 5-second timeout to verify the server is reachable
2. Add `connectionState` tracking: `'connecting' | 'connected' | 'failed'`
3. Use LiveKitRoom's `onError` callback to catch runtime connection failures
4. Replace the plain error text with an `Alert` component showing:
   - **Icon**: `WifiOff` for unreachable server, `AlertTriangle` for auth/config errors
   - **Title**: "Video server unreachable" or "Connection failed"
   - **Description**: User-friendly guidance (e.g. "The video server is not responding. This may be due to server maintenance. Please try again later or contact your administrator.")
   - **Actions**: Retry button + Close button
5. Add a connection timeout (15s) — if LiveKitRoom doesn't connect within that window, show the error state automatically

**Update `supabase/functions/livekit-token/index.ts`**

6. Add a server-side URL validation: check that `LIVEKIT_URL` starts with `wss://` and return a clearer error message if misconfigured (e.g. `"LiveKit server URL is invalid"`)

### Files
| File | Action |
|------|--------|
| `src/components/classroom/VideoClassroom.tsx` | Update — WebSocket pre-check, Alert UI, connection timeout |
| `supabase/functions/livekit-token/index.ts` | Update — validate URL format |

