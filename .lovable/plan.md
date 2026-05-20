## Goal
Fix "Edge Function returned a non-2xx status code" when joining a live class, without touching any other edge function.

## Root cause
`livekit-token` rejects with `"LiveKit server URL is invalid. It must start with wss://"`. The `LIVEKIT_URL` secret is either still `https://...` or has stray whitespace/newline from paste.

## Changes (scoped to one file)

**`supabase/functions/livekit-token/index.ts`** — defensive URL normalization only. No behavior change for other functions.

1. Read `LIVEKIT_URL`, then:
   - `.trim()` to strip whitespace/newlines.
   - If it starts with `https://` → rewrite to `wss://`.
   - If it starts with `http://` → rewrite to `ws://` (then reject, since LiveKit Cloud requires wss).
   - Strip trailing `/`.
2. Validate the normalized value starts with `wss://`; otherwise return a clear error including the (masked) prefix it actually saw, so future misconfig is obvious.
3. Return the normalized URL to the client.

## Then verify
- Re-test via the edge-functions curl tool with a sample payload → expect a token + `wss://` url.
- Ask the user to retry "Start class" in the preview.

## Untouched
- `heartbeat`, `admin-query`, `auth-proxy`, `public-courses`, `public-batches`, `cashfree-*`, `compile-font`, `seed-demo-users`, `fast-login-profile`, `record-login-attempt`, `change-password`, `promote-to-parent` — none are modified.
- `VideoClassroom.tsx` already pre-checks the wss URL and surfaces the error gracefully, so no client change needed.

## If still failing after deploy
The secret itself is wrong. I'll prompt `update_secret` once more with explicit guidance: paste exactly `wss://class-e31h62p3.livekit.cloud` (no quotes, no trailing slash, no spaces).
