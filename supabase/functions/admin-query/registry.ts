import type { ActionHandler } from './_shared/types.ts'
import { handle as stats } from './handlers/stats.ts'
import { handle as users } from './handlers/users.ts'
import { handle as organizations } from './handlers/organizations.ts'
import { handle as leads } from './handlers/leads.ts'
import { handle as enrollments } from './handlers/enrollments.ts'
import { handle as schedules } from './handlers/schedules.ts'
import { handle as attendance } from './handlers/attendance.ts'
import { handle as liveClasses } from './handlers/liveClasses.ts'
import { handle as materials } from './handlers/materials.ts'
import { handle as payments } from './handlers/payments.ts'
import { handle as payroll } from './handlers/payroll.ts'
import { handle as notifications } from './handlers/notifications.ts'
import { handle as courses } from './handlers/courses.ts'
import { handle as batches } from './handlers/batches.ts'
import { handle as subscriptions } from './handlers/subscriptions.ts'
import { handle as coupons } from './handlers/coupons.ts'
import { handle as sessions } from './handlers/sessions.ts'
import { handle as parents } from './handlers/parents.ts'
import { handle as assignments } from './handlers/assignments.ts'

// Ordered list of domain handlers. Dispatcher walks the list and stops at
// the first one that owns the action. Lookup is O(handlers) ~ 19, which
// is faster than the prior 2,475-line monolithic switch.
export const HANDLERS: ActionHandler[] = [
  stats,
  users,
  organizations,
  leads,
  enrollments,
  schedules,
  attendance,
  liveClasses,
  materials,
  payments,
  payroll,
  notifications,
  courses,
  batches,
  subscriptions,
  coupons,
  sessions,
  parents,
  assignments,
]