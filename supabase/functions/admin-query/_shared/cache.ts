import { stableStringify } from './helpers.ts'

// Per-instance micro-cache for read-only hot actions. Lives only while
// the worker is warm; absorbs bursty navigation without serving stale
// data for long.
const DEFAULT_TTL_MS = 5_000

// Single source of truth: action → TTL (ms). Presence in this map means
// "cacheable"; absence means "always live". Previously this was split
// across READ_CACHEABLE_ACTIONS + TTL_OVERRIDES and the two could drift.
const CACHEABLE: Record<string, number> = {
  get_stats: 15_000,
  get_support_overview: 15_000,
  revenue_analytics: 15_000,
  org_performance: 15_000,
  student_trends: 15_000,
  system_health: 15_000,
  get_teacher_dashboard: 30_000,
  get_student_dashboard: 30_000,
  get_parent_dashboard: 30_000,
  metric_breakdown: 30_000,
  list_courses: DEFAULT_TTL_MS,
  list_course_modules: DEFAULT_TTL_MS,
  list_teachers: DEFAULT_TTL_MS,
  list_all_students: DEFAULT_TTL_MS,
  list_students_with_batches: DEFAULT_TTL_MS,
  list_batches: DEFAULT_TTL_MS,
  list_batch_students: DEFAULT_TTL_MS,
  list_organizations: DEFAULT_TTL_MS,
  list_subscription_plans: DEFAULT_TTL_MS,
  list_users: DEFAULT_TTL_MS,
  list_payments: DEFAULT_TTL_MS,
  list_schedules: DEFAULT_TTL_MS,
  list_materials: DEFAULT_TTL_MS,
  list_practice_assignments: DEFAULT_TTL_MS,
  list_coupons: DEFAULT_TTL_MS,
  list_parents: DEFAULT_TTL_MS,
  list_notifications: DEFAULT_TTL_MS,
  list_classroom_settings: DEFAULT_TTL_MS,
}

export function isCacheable(action: string): boolean {
  return action in CACHEABLE
}

// Back-compat export for any callers that still reference the set form.
export const READ_CACHEABLE_ACTIONS = new Set<string>(Object.keys(CACHEABLE))

// Map of action → list of read actions whose cache should be flushed
// for the active org when that mutating action runs.
const INVALIDATIONS: Record<string, string[]> = {
  create_user: ['list_users', 'get_stats'],
  update_user: ['list_users'],
  delete_user: ['list_users', 'get_stats'],
  change_role: ['list_users'],
  toggle_user_active: ['list_users'],
  create_organization: ['list_organizations', 'get_stats'],
  delete_organization: ['list_organizations', 'get_stats'],
  toggle_org_active: ['list_organizations'],
  update_org_branding: ['list_organizations'],
  create_lead: ['list_leads', 'get_stats', 'get_support_overview'],
  update_lead: ['list_leads'],
  delete_lead: ['list_leads', 'get_stats'],
  approve_lead: ['list_leads', 'list_all_students', 'list_students_with_batches', 'get_stats'],
  record_lead_payment: ['list_leads'],
  create_course: ['list_courses', 'get_stats'],
  update_course: ['list_courses'],
  delete_course: ['list_courses', 'get_stats'],
  create_course_module: ['list_course_modules', 'list_courses'],
  update_course_module: ['list_course_modules'],
  delete_course_module: ['list_course_modules'],
  create_lesson: ['list_course_modules'],
  update_lesson: ['list_course_modules'],
  delete_lesson: ['list_course_modules'],
  create_batch: ['list_batches', 'get_stats'],
  update_batch: ['list_batches'],
  delete_batch: ['list_batches', 'get_stats'],
  add_batch_student: ['list_batch_students', 'list_batches'],
  remove_batch_student: ['list_batch_students', 'list_batches'],
  create_schedule: ['list_schedules'],
  update_schedule: ['list_schedules'],
  delete_schedule: ['list_schedules'],
  bulk_create_schedules: ['list_schedules'],
  save_attendance: [],
  create_live_class: [],
  update_live_class: [],
  delete_live_class: [],
  create_material: ['list_materials'],
  delete_material: ['list_materials'],
  create_payment: ['list_payments', 'get_stats', 'get_support_overview'],
  update_payment: ['list_payments', 'get_support_overview'],
  create_payroll: [],
  update_payroll: [],
  create_notification: ['list_notifications'],
  mark_read: ['list_notifications'],
  delete_notification: ['list_notifications'],
  create_subscription_plan: ['list_subscription_plans'],
  update_subscription_plan: ['list_subscription_plans'],
  delete_subscription_plan: ['list_subscription_plans'],
  create_coupon: ['list_coupons'],
  update_coupon: ['list_coupons'],
  delete_coupon: ['list_coupons'],
  create_practice_assignment: ['list_practice_assignments'],
  update_practice_assignment: ['list_practice_assignments'],
  delete_practice_assignment: ['list_practice_assignments'],
  review_student_submission: [],
  add_parent_child: ['list_parent_children', 'list_parents'],
  remove_parent_child: ['list_parent_children', 'list_parents'],
  set_user_organizations: ['list_organizations', 'list_users'],
  add_org_member: ['list_organizations', 'list_users'],
  remove_org_member: ['list_organizations', 'list_users'],
  upsert_classroom_settings: ['list_classroom_settings'],
  delete_classroom_settings: ['list_classroom_settings'],
}

type CacheEntry = { expiresAt: number; payload: any }
const readCache = new Map<string, CacheEntry>()

export function cacheKey(
  action: string,
  callerId: string | null,
  orgId: string | null,
  params: any,
): string {
  // stableStringify ensures {a:1,b:2} and {b:2,a:1} share a cache slot.
  return `${action}|${callerId ?? 'anon'}|${orgId ?? 'global'}|${stableStringify(params ?? {})}`
}

export function readFromCache(key: string): any | undefined {
  const e = readCache.get(key)
  if (!e) return undefined
  if (e.expiresAt < Date.now()) {
    readCache.delete(key)
    return undefined
  }
  return e.payload
}

export function writeToCache(action: string, key: string, payload: any) {
  if (readCache.size > 400) {
    const first = readCache.keys().next().value
    if (first) readCache.delete(first)
  }
  const ttl = CACHEABLE[action] ?? DEFAULT_TTL_MS
  readCache.set(key, { expiresAt: Date.now() + ttl, payload })
}

// Drop all cached entries for the given action+org scope (any caller, any params).
export function invalidateForAction(action: string, orgId: string | null) {
  const targets = INVALIDATIONS[action]
  if (!targets || targets.length === 0) return
  const targetSet = new Set(targets)
  const orgTag = orgId ?? 'global'
  for (const key of [...readCache.keys()]) {
    const [act, , org] = key.split('|')
    if (!targetSet.has(act)) continue
    if (org !== orgTag && orgId !== null) continue
    readCache.delete(key)
  }
}