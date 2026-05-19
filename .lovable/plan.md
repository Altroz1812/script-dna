## Fix Activity/Login Logs + Add Active Users & Session History

### Findings (root causes)

1. **Activity logs look empty/sparse**: `activity_logs` has 338 rows in DB, but the API filters them with `.not('user_id', 'is', null)`. About half the rows have `user_id = null` (triggers fire from edge functions running as service role, where `auth.uid()` is null). Those rows are silently hidden.
2. **Login attempts table is empty (0 rows)**: Nothing ever inserts into `login_attempts`. `AuthContext.signIn` calls `supabase.auth.signInWithPassword` directly and never records the attempt.
3. **Active users / session history don't exist** — no table, no API, no UI.

### Changes

#### A. Backend — record what's happening

1. **New `record-login-attempt` edge function** (`verify_jwt = false`)
   - Body: `{ email, success, error_code? }`
   - Captures `x-forwarded-for` / `cf-connecting-ip` and `user-agent` from request headers.
   - Inserts into `login_attempts` (extended — see migration below).
   - On success, also inserts a row into new `user_sessions` table tying the auth user to a session record (looked up via `auth.admin.getUserByEmail`).

2. **Migration**
   - `ALTER TABLE login_attempts ADD COLUMN user_agent text, error_code text, user_id uuid` (nullable; populated on success).
   - `CREATE TABLE user_sessions ( id uuid pk, user_id uuid not null, started_at timestamptz default now(), last_seen_at timestamptz default now(), ended_at timestamptz, ip_address text, user_agent text )`.
   - Enable RLS. SuperAdmin/Admin SELECT via `has_role`. Service role inserts/updates via edge function.
   - Index: `(user_id, started_at desc)`, `(last_seen_at desc) where ended_at is null`.

3. **New `heartbeat` edge function** (`verify_jwt = true`)
   - Updates `user_sessions.last_seen_at = now()` for the caller's most recent open session.
   - Called every 60s from `AuthContext` while logged in.
   - On `signOut`, sets `ended_at = now()` on the open session.

#### B. Frontend — wire it up

1. **`AuthContext.signIn` / `signUp` / `signOut`**
   - After every sign-in result (success or failure), fire-and-forget invoke `record-login-attempt`.
   - On successful auth state change, start a 60s `setInterval` calling `heartbeat`. Clear on sign-out / unmount.
   - `signOut` invokes `heartbeat` with `{ end: true }` first (best-effort).

2. **`admin-query` edge function — `list_activity_logs` fix**
   - Remove `.not('user_id', 'is', null)` filter — show all rows; UI already handles "—" for missing user.
   - Enrich rows with no user_id by labeling them `System` instead of "Unknown".
   - Return `login_attempts` with new fields (`user_agent`, `error_code`).

3. **New `admin-query` actions**
   - `list_active_sessions` — `user_sessions` where `ended_at is null AND last_seen_at > now() - interval '5 minutes'`, joined to profiles for name/email/role.
   - `list_session_history` — paginated `user_sessions` joined to profiles, ordered by `started_at desc`, with optional `user_id` filter.

4. **`ActivityLogsPage.tsx` — add two tabs**
   - **Active Users** tab: live list (name, email, role, IP, user agent, started, last seen) with auto-refresh every 30s. Green dot for `last_seen < 1 min`.
   - **Session History** tab: paginated table (user, started, ended, duration, IP, UA). Filter by user.
   - Existing **Login Attempts** tab now shows real data (with UA/error code columns) and a per-email click-through to that user's session history.
   - Existing **Activity** tab shows all rows (including system) with a "System" badge for null user.

5. **Realtime** (optional, low-risk)
   - `ALTER PUBLICATION supabase_realtime ADD TABLE user_sessions, login_attempts` so the Active Users tab can react instantly to logins/sign-outs.

### Out of scope
- Geolocation lookup for IPs (just show raw IP + UA).
- Per-org session quotas / forced sign-out tooling — can be a follow-up.

### Files touched
```
supabase/migrations/<ts>_login_logs_and_sessions.sql   (new)
supabase/functions/record-login-attempt/index.ts        (new)
supabase/functions/heartbeat/index.ts                   (new)
supabase/functions/admin-query/index.ts                 (fix + 2 new actions)
src/contexts/AuthContext.tsx                            (instrument signIn/Out + heartbeat)
src/pages/ActivityLogsPage.tsx                          (4 tabs, new columns)
src/services/api/adminService.ts                        (only if action whitelist exists)
```

### Verification
1. Sign in with wrong password → `login_attempts` gets a row with `success=false`; visible in UI within seconds.
2. Sign in successfully → `success=true` row + new `user_sessions` row appears in Active Users tab.
3. Wait > 5 min idle → user falls off Active Users; row remains in Session History with `ended_at` set on sign-out.
4. Activity tab now shows ~338 historic rows (previously hidden).