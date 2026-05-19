# AuraPen Enterprise Scale & Refactor Plan (Parked)

> Status: **Parked for later.** User will ping when ready to execute. Review again after testing.

## Goals
1. Refactor `admin-query` + `auth-proxy` into modular, fast edge functions.
2. Cut continuous DB load from live classes (polling → realtime).
3. Architect for **1000+ daily concurrent students**, parallel batches, continuous Canvas writing — without melting Postgres.
4. Cleanly separate three heavy workloads onto **dedicated services**:
   - Video classroom (LiveKit cluster)
   - Canvas / handwriting capture + replay
   - Document uploads + OCR
5. Web app (Lovable Cloud + React) becomes a **thin coordinator** — auth, metadata, orchestration only.

---

## Target Architecture

```text
                    ┌─────────────────────────────────────┐
                    │         AuraPen Web App             │
                    │   (React + Lovable Cloud edge fns)  │
                    │   Auth · Metadata · Coordination    │
                    └──────────────┬──────────────────────┘
                                   │ JWT (short-lived)
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
  ┌───────────────┐       ┌────────────────┐      ┌──────────────────┐
  │ Video Service │       │ Canvas Service │      │  OCR / Uploads   │
  │  (LiveKit +   │       │ (Stroke ingest │      │  (Object store + │
  │  signaling)   │       │  + replay CDN) │      │   OCR workers)   │
  └───────┬───────┘       └───────┬────────┘      └────────┬─────────┘
          │                       │                        │
          │ events                │ aggregated writes      │ result events
          └───────────────────────┴────────┬───────────────┘
                                           ▼
                                  ┌─────────────────┐
                                  │  Postgres (RLS) │
                                  │  metadata only  │
                                  └─────────────────┘
```

Principle: **hot per-tick data never touches Postgres directly.** Only summaries, results, and metadata persist via Lovable Cloud.

---

## Workstream 1 — Edge function refactor (admin-query + auth-proxy)

Final layout:

```text
supabase/functions/
├── _shared/
│   ├── cors.ts
│   ├── auth.ts            # JWT decode + role/org resolve (+60s in-memory cache)
│   ├── org-scope.ts       # multi-tenant filters
│   ├── db.ts              # request-scoped client + memoizer
│   ├── query-helpers.ts   # pagination, overlap, common selects
│   ├── roles.ts
│   └── errors.ts
├── admin-query/
│   ├── index.ts           # ~60 lines, router only
│   ├── router.ts          # typed Record<Action, Handler>
│   ├── middleware.ts
│   └── handlers/
│       ├── users.ts  organizations.ts  courses.ts  batches.ts
│       ├── enrollments.ts  schedules.ts  live-classes.ts
│       ├── attendance.ts  payments.ts  payroll.ts  leads.ts
│       ├── notifications.ts  curriculum.ts  practice.ts
│       └── analytics.ts
└── auth-proxy/
    └── index.ts           # imports from _shared/
```

Expected impact (admin paths): cold start −20–25%, warm requests −30–40%, DB queries per request −~40%.

---

## Workstream 2 — Database load reduction (continuous load paths)

| Path | Today | Change | DB load impact |
|---|---|---|---|
| `VideoClassroom` polls `live_classes` every 3s | ~1,200 q/hr per 20-student room | Replace with **Supabase Realtime** subscription | −~99% on this path |
| Conflict checks in `BatchesPage` / `SchedulePage` | Full scans | Add indexes: `idx_schedules_batch_dow`, `idx_schedules_date`, `idx_batch_students_student` | 80ms → <15ms |
| `user_roles` / `organization_members` re-read | Every request | 60s in-memory LRU in `_shared/auth.ts` | −20–30% global |
| `auto_mark_attendance_on_class_end` trigger | Bulk insert per class end | Batch + defer via queue when >50 students | Smooths spikes |

---

## Workstream 3 — Canvas service (continuous, unpredictable load) — BIGGEST SCALE RISK

A student writing for 30 min produces 60–240 strokes/sec at 120–240 Hz. Writing per stroke to Postgres = guaranteed meltdown at 1000+ users.

### Architecture
```text
Browser canvas
  → batched stroke chunks (every 250ms, ~30KB)
  → Canvas Ingest Service (Node/Bun on Fly.io / Render / VM)
       ├─ buffer in Redis (per session key)
       ├─ on session end / 30s idle → flush to Object Storage (S3/R2) as .ndjson.gz
       └─ write *one* metadata row to Postgres (session id, char id, blob URL, summary)
  → Replay served from CDN (signed URL, immutable)
```

### Why a separate server
- Sustained WebSocket ingest at 1000+ concurrent writers is not what Supabase edge functions are sized for.
- Object storage + CDN is ~100× cheaper than row storage for stroke blobs.
- Postgres sees ~1 row per session instead of thousands per minute.

### What stays in Lovable Cloud
- `stroke_recordings` table: 1 row per completed session, points at blob URL.
- `font_library` (training source of truth) — unchanged.
- Auth + RLS still gate who can read which blob URL (signed by web app).

### Per-tick scoring
- Validation / shape detection stays **client-side** (`useStrokeValidator`, `useShapeDetector`).
- Aggregated score sent with the session flush — not per stroke.

---

## Workstream 4 — Video classroom service
Already separate (LiveKit). Harden:
- Move waiting-room presence off Postgres polling → LiveKit data channels or Realtime presence.
- `heartbeat` function: batch writes once per 30s.
- LiveKit cluster sized by **concurrent rooms** (~50 parallel batches target).

---

## Workstream 5 — Documents + OCR service
Independent worker pool:
- Upload direct to Object Storage from browser via signed URL.
- Worker subscribes to upload events → OCR (Tesseract / vendor) → writes result row + extracted text back via Lovable Cloud.
- Web app never proxies file bytes.

---

## Workstream 6 — Web app as coordinator

Responsibilities (only these):
- Auth (login, JWT, RBAC).
- Metadata CRUD via `admin-query`.
- **Sign URLs** for canvas blobs, uploads, OCR results, LiveKit tokens.
- Realtime subscriptions for status changes.
- Dashboards from cached + aggregated tables.

Web app should NEVER:
- Stream stroke data through itself.
- Proxy video or uploaded file bytes.
- Run OCR.

---

## Phasing

1. **Phase 1 (in-codebase)** — Edge function refactor (W1) + indexes + Realtime swap for `VideoClassroom` polling + 60s role cache. Lowest risk, ~25–35% admin speedup, ~95% live-class DB cut.
2. **Phase 2** — Canvas Ingest Service spec + deploy (external). Migrate `stroke_recordings` writes to blob+metadata.
3. **Phase 3** — OCR/Uploads worker, harden LiveKit presence, batch attendance triggers.

Phases 2–3 require external provisioning (Fly.io / Render / Cloudflare R2 / Redis), coordinated from Lovable Cloud.

---

## Expected end-state at 1000+ daily students
- Postgres writes/day: ~60–75% lower than current trajectory.
- Canvas data cost: ~100× cheaper (object storage vs rows).
- Admin UI: 25–35% faster.
- Live-class status updates: ~6× faster, ~95% less DB cost.
- Each subsystem scales independently.

---

## Open decisions (revisit when resuming)
1. Confirm Phase 1 scope to ship first.
2. Phase 2 host: Fly.io / Render / Cloudflare Workers + R2 / self-hosted VM?
3. Phase 3 OCR: vendor (Google Vision / AWS Textract) or self-hosted Tesseract?

---

## Out of scope
- Changing public action names / response shapes.
- DB schema changes beyond indexes in Phase 1.
- Building external Phase 2/3 services in this PR.
- Automated test suite.
