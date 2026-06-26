// Defense-in-depth: actions in this set are tenant-scoped data reads /
// writes. A non-superadmin caller MUST end up with a resolved org scope —
// either by passing target_org_id, or by being a single-org member.
// Multi-org callers who didn't pick (frontend bug) get a 403 instead of
// an unscoped result that could leak cross-org data.
export const ORG_SCOPED_ACTIONS = new Set<string>([
  'get_stats',
  'list_users', 'create_user',
  'list_leads', 'create_lead', 'update_lead', 'delete_lead',
  'approve_lead',
  'record_lead_payment',
  'list_enrollments',
  'list_schedules', 'create_schedule', 'update_schedule', 'delete_schedule', 'bulk_create_schedules',
  'list_attendance', 'save_attendance',
  'list_live_classes', 'create_live_class', 'update_live_class', 'delete_live_class',
  'list_materials', 'create_material', 'delete_material',
  'list_payments', 'create_payment', 'update_payment',
  'list_payroll', 'create_payroll', 'update_payroll',
  'list_notifications', 'create_notification',
  'list_courses', 'create_course', 'update_course', 'delete_course',
  'list_coupons', 'create_coupon', 'update_coupon', 'delete_coupon',
  'list_activity_logs',
  'list_active_sessions',
  'list_session_history',
  'get_support_overview',
  'list_course_modules', 'create_course_module', 'update_course_module', 'delete_course_module',
  'create_lesson', 'update_lesson', 'delete_lesson',
  'list_students_with_batches', 'list_all_students', 'list_teachers',
  'list_batches', 'create_batch', 'update_batch', 'delete_batch',
  'get_batch_detail',
  'list_batch_students', 'add_batch_student', 'remove_batch_student', 'batch_student_count',
  'revenue_analytics', 'org_performance', 'student_trends',
  'system_health',
  'list_practice_assignments', 'create_practice_assignment', 'update_practice_assignment', 'delete_practice_assignment',
  'list_student_submissions', 'review_student_submission',
])