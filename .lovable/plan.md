# Refactor `admin-query` into Modular Handlers

The `supabase/functions/admin-query/index.ts` file is a 2,475-line monolith with ~100 action cases mixed together (users, orgs, leads, batches, courses, payments, payroll, schedules, attendance, live classes, certificates, assignments, analytics, etc.). Every request currently re-runs the full auth + role + memberships lookup and falls through a giant `switch`. This refactor splits it cleanly without changing any client contract.

## Goals

- **One file per page/domain** of handlers, easy to read and edit.
- **Shared global resources** (Supabase client, caller context, micro-cache, helpers) — fetched once per request, reused across all handlers.
- **Fewer DB round-trips** — batch caller identity, role, and org memberships into a single resolver; expand the read-cache; add 304-style ETag short-circuits for hot lists.
- **Same public API** — action names, params, and response shape stay byte-for-byte compatible (client code in `src/services/*` and pages do not change).

## New folder layout

```text
supabase/functions/admin-query/
  index.ts                  # entrypoint: parse → resolve context → dispatch
  _shared/
    cors.ts                 # CORS headers + responders (json, error, 403)
    supabase.ts             # singleton service-role client (module-scope)
    context.ts              # resolveCaller(): roles + memberships + targetOrgId
    cache.ts                # micro-cache (TTL + LRU) + cache key builder
    guards.ts               # ORG_SCOPED_ACTIONS, requireRole(), requireOrg()
    orgScope.ts             # applyOrgFilter(query, orgId) helper
    types.ts                # HandlerCtx, HandlerResult, ActionHandler
  handlers/
    stats.ts                # get_stats, revenue_analytics, org_performance,
                            #   student_trends, system_health
    users.ts                # list_users, create_user, update_user, delete_user,
                            #   change_role, toggle_user_active,
                            #   admin_reset_password, check_email_exists
    organizations.ts        # list/create/delete_organization,
                            #   toggle_org_active, update_org_branding,
                            #   list/add/remove_org_member,
                            #   set_user_organizations
    leads.ts                # list/create/update/delete_lead,
                            #   approve_lead, record_lead_payment,
                            #   get_support_overview
    courses.ts              # list/create/update/delete_course,
                            #   list/create/update/delete_course_module,
                            #   create/update/delete_lesson
    batches.ts              # list/create/update/delete_batch,
                            #   get_batch_detail,
                            #   list/add/remove_batch_student,
                            #   batch_student_count
    schedules.ts            # list/create/update/delete_schedule,
                            #   bulk_create_schedules,
                            #   check_teacher_conflicts,
                            #   check_student_conflicts,
                            #   check_slot_conflicts
    attendance.ts           # list_attendance, save_attendance
    liveClasses.ts          # list/create/update/delete_live_class
    materials.ts            # list/create/delete_material
    assignments.ts          # list/create/update/delete_practice_assignment,
                            #   list_student_submissions,
                            #   review_student_submission
    payments.ts             # list/create/update_payment
    payroll.ts              # list/create/update_payroll
    notifications.ts        # list/create/mark_read/delete_notification
    subscriptions.ts        # list/create/update/delete_subscription_plan,
                            #   list/assign/cancel_org_subscription
    coupons.ts              # list/create/update/delete_coupon
    enrollments.ts          # list_enrollments, list_students_with_batches,
                            #   list_all_students, list_teachers
    parents.ts              # list_parent_children, add/remove_parent_child,
                            #   list_parents
    sessions.ts             # list_active_sessions, list_session_history,
                            #   list_activity_logs
  registry.ts               # maps action string → handler function
```

## Shared context & caching

- `resolveCaller()` runs once per request and returns `{ userId, roles, isSuperadmin, isAdmin, isSupport, isTeacher, memberships, targetOrgId }`. Today this lookup happens at the top of the handler and is re-derived inside several cases — consolidating it removes the duplicate `user_roles` / `organization_members` queries inside batch/lead/course handlers.
- `cache.ts` keeps the existing 5 s micro-cache but:
  - widens the cacheable set to include `list_users`, `list_batch_students`, `list_payments`, `list_schedules`, `list_materials`, `list_practice_assignments`, `list_coupons`, `list_subscription_plans`, `list_course_modules`, `list_parents`;
  - bumps TTL to 15 s for stats/analytics actions (`get_stats`, `revenue_analytics`, `org_performance`, `student_trends`, `system_health`);
  - exposes `invalidate(action | tag, orgId)` and mutating handlers call it (e.g. `create_batch` invalidates `list_batches` for that org) so writes don't get stale reads after the TTL window.
- Add a tiny `withETag(payload)` helper: hash the JSON, return `X-Cache-Tag`; if the client echoes `If-None-Match`, return `304` with empty body. Saves bandwidth for unchanged polled lists.

## Dispatcher

`index.ts` becomes ~60 lines:

```text
1. CORS preflight
2. Parse body { action, params, target_org_id }
3. resolveCaller(req) → ctx
4. guards.requireOrgScope(action, ctx)
5. cache.tryServe(action, ctx, params)
6. registry[action](ctx, params)
7. cache.store + respond with JSON
```

`registry.ts` is a flat `Record<string, ActionHandler>` built by importing each handler module — no giant switch.

## Migration approach (zero-risk)

1. Add new files alongside the existing `index.ts`.
2. Move handlers domain-by-domain; after each move, the dispatcher delegates that action to the new handler. Old switch cases are removed only after their replacement is wired.
3. Each handler keeps the **exact** SQL, params, and response shape from the original. Diff-friendly: reviewers can match line-for-line.
4. Final commit deletes the leftover switch and reduces `index.ts` to the dispatcher.

## Out of scope

- No changes to RLS, tables, or other edge functions.
- No changes to frontend service files (`src/services/adminQuery.ts` etc.).
- No new business logic — purely structural + caching.

## Expected outcome

- `index.ts` shrinks from 2,475 → ~60 lines; each handler file 80–250 lines.
- 1 fewer DB query per request on average (caller context dedup).
- Hot list pages (Users, Batches, Payments, Assignments) served from in-memory cache on rapid navigation; analytics pages cached for 15 s.
- Cold-start unchanged; warm response latency drops noticeably on repeat reads.
