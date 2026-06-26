
# Load Analysis: 400 Parallel Users

Snapshot of where the app will bend (or break) at 400 concurrent logins, normal data access, and a live video class — based on current DB health, slow-query stats, edge-function code, and frontend polling.

## 1. Current baseline (from live signals)

- DB connections **14 / 60** used, PgBouncer pool **1 / 200**, memory **48 %**, disk **4 %**. Headroom exists, but the connection ceiling (60 direct / 200 pooled) is the hard wall at scale.
- Rolled-back transactions: **6 960 since boot** — high, almost certainly from the `user_sessions` heartbeat UPDATE races and `record-login-attempt` retries.
- Top hot queries by total time:
  1. `user_sessions UPDATE last_seen_at` — 4 863 calls
  2. `user_sessions SELECT open session` — 5 013 calls
  3. `login_attempts INSERT` — 165 calls
  4. `user_roles SELECT by user_id` — 3 601 calls
  5. `organization_members + organizations` join — 212 calls
  6. `live_classes + batches + courses` join — 107 calls

## 2. Bottlenecks at 400 concurrent users

### A. Login burst (T0 … T0+30 s)

Per login the client fires (parallel):
- `POST /auth/v1/token` (GoTrue)
- `GET profiles`, `GET user_roles`, `GET organization_members` (3 PostgREST round-trips)
- `POST /functions/v1/record-login-attempt` → INSERT login_attempts + INSERT user_sessions
- `POST /functions/v1/heartbeat` → getUser + SELECT + INSERT user_sessions
- `GET notifications`, `GET live_classes`, `GET batches`, `GET practice_assignments`, `GET student_submissions`

≈ **10–12 requests × 400 users ≈ 4 000–4 800 requests in <10 s**.

Risks:
- GoTrue rate-limits and CPU spike.
- PgBouncer pool saturation — edge functions open service-role clients per invocation (no keep-alive across cold starts).
- Duplicate `user_sessions` rows (heartbeat + record-login-attempt both insert) → row contention, rollbacks.
- `activity_logs` audit trigger amplifies every INSERT/UPDATE.

### B. Steady-state data access

- **Heartbeat every 60 s**: 400 users × 1/min = 6.7 rps continuous, each doing `auth.getUser` (network hop to GoTrue) + SELECT + UPDATE on `user_sessions`. Dominates the slow-query table.
- Dashboard pages do N+1 nested PostgREST embeds (`live_classes → batches → courses`) which cost 6–10 ms each; 400 dashboards loading simultaneously = ≈ 2–4 s of DB time bursted.
- RLS policies that call `has_role` / `user_in_org` execute on every row scan — fine now, expensive once `batches`/`live_classes` grow.
- Realtime channels (`leads`, `attendance`, `live_classes`, `payments`) — 400 WebSockets to the Realtime server each subscribed to multiple tables.

### C. Video class (LiveKit)

- `livekit-token` does `auth.getUser` (PostgREST → GoTrue) + `SELECT user_roles` per join — 2 hops, ~50–80 ms each. 400 simultaneous joins → 800 quick requests.
- LiveKit room: one room with 400 publishers/subscribers is **not supported on a single SFU node** without scaling out; default LiveKit Cloud caps and bandwidth (≈ 400 × 500 kbps = 200 Mbps downstream per subscriber × N) will collapse without simulcast tiering and forced "viewer" tracks.
- Current code already enables simulcast + adaptiveStream + viewer-only publish — good — but no **max-participants guard**, no **dynacast**, no **active-speaker-only subscription**.
- Reconnect storms: if LiveKit hiccups, all 400 clients re-request a token in the same second → edge function cold-start fan-out.

### D. Connection ceiling

60 direct Postgres connections shared between PostgREST, edge functions (each `createClient` per invocation), Realtime, and triggers. At 400 concurrent edge-function executions you will see **"remaining connection slots are reserved"** errors well before DB CPU saturates.

## 3. Proposed fixes (ordered by impact)

### P0 — Will break at 400 without these

1. **Add missing indexes** (single migration):
   - `user_sessions (user_id) WHERE ended_at IS NULL` (partial)
   - `user_sessions (user_id, started_at DESC)`
   - `login_attempts (email, created_at DESC)`
   - `user_roles (user_id)` (verify exists; query shows 3 601 calls)
   - `notifications (user_id, created_at DESC)`
   - `live_classes (status, scheduled_at)` and `live_classes (batch_id, scheduled_at)`
2. **Throttle heartbeat**: bump interval from 60 s → 5 min, skip when tab hidden (`document.hidden`), debounce on focus. Cuts user_sessions writes ~5×.
3. **Collapse login session writes**: remove duplicate `user_sessions` INSERT from `record-login-attempt`; let `heartbeat` own session lifecycle. Cuts rollbacks and contention.
4. **Cache edge-function Supabase client** at module scope (already partly done in `admin-query/_shared`; replicate for `heartbeat`, `livekit-token`, `record-login-attempt`). Avoids reopening pooled connections per invocation.
5. **Upgrade Lovable Cloud instance size** before the load test — the 60-connection / 200-pool ceiling is the binding constraint, not CPU. Document this in the runbook.

### P1 — Reduce thundering herds

6. **Stagger heartbeat & realtime reconnect**: add ±15 s jitter on first ping and on socket reconnect to flatten the spike.
7. **Combine login bootstrap into one RPC**: new `get_bootstrap(user_id)` SECURITY DEFINER function returning `{profile, roles, orgs, unread_notifs}` in one round trip. Cuts 3–4 PostgREST hits per login.
8. **Cache `user_roles` in JWT custom claims** via auth hook → drop the per-request `SELECT user_roles` in `livekit-token` and other guards. Cuts the #4 hot query entirely.
9. **Disable `activity_logs` audit trigger** on hot-write tables (`user_sessions`, `notifications`, `attendance`) or move it to an async queue.

### P2 — Video stability under 400-viewer load

10. **Hard cap publishers**: server-side token issues `canPublish=false` to all but teacher; current code does this, but also set `maxParticipants` on the room create call.
11. **Enable dynacast + activeSpeaker-only subscription** in `VideoClassroom` so subscribers only pull the speaking track.
12. **Token reuse on reconnect**: cache token in `sessionStorage` until `exp - 60 s`; avoid re-invoking `livekit-token` on every reconnect.
13. **Add backpressure on token endpoint**: in-memory per-IP/per-user rate limit (e.g., 5 req/min) inside the edge function.
14. **Plan for SFU scale-out**: if single-room >100 active video tracks is real, move to LiveKit Cloud's distributed mesh tier or shard rooms by batch.

### P3 — Observability

15. Add structured logging (request id, user id, duration_ms) to `heartbeat`, `livekit-token`, `record-login-attempt`, `admin-query` so we can rerun this analysis from real load data instead of inference.
16. Surface `pg_stat_statements` + `pg_stat_activity` snapshots on the SuperAdmin System Monitoring page.

## 4. What I will NOT change in this pass

- Auth provider, RLS model, multi-tenancy contract, public action contract of `admin-query`, UI/UX of any page. All fixes are infra / query / edge-function only.

## 5. Recommended sequence

1. Migration: indexes + drop duplicate session insert.
2. Edge functions: shared client, heartbeat throttle, token cache, structured logs.
3. Frontend: heartbeat interval/jitter, sessionStorage token cache, dashboard query consolidation.
4. Video: dynacast + activeSpeaker subscription, room maxParticipants.
5. Load test (k6 or Artillery script hitting login → dashboard → join class) → tune.

---

**Approve to implement P0+P1 (highest ROI, no UX risk) first**, or pick a different slice (e.g. video-only, login-only) and I'll narrow the build.
