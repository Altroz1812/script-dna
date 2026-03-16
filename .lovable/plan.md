

## Super Admin Feature Audit

### Current State vs Required Features

Here's a gap analysis of what exists and what needs to be built:

#### 1. Platform Control
| Feature | Status |
|---------|--------|
| Create/manage institutes (tenants) | **Exists** — Organizations page with CRUD |
| Enable/disable institute accounts | **Missing** — No active/inactive toggle |
| White-label branding management | **Missing** — No branding config per org |
| Manage subscription plans | **Missing** — No subscription/plan system |

#### 2. User Management
| Feature | Status |
|---------|--------|
| View all users across institutes | **Exists** — Users page |
| Create/edit/deactivate users by role | **Partial** — Can edit name & change role, but no create-user or deactivate (soft-delete) |
| Reset passwords | **Missing** — No admin password reset |
| Assign institute admins | **Partial** — Can change role + add to org, but no dedicated flow |

#### 3. Course Management
| Feature | Status |
|---------|--------|
| Create master courses | **Exists** — Courses page |
| Manage curriculum structure | **Missing** — No modules/lessons hierarchy |
| Upload learning content | **Exists** — Materials page |
| Configure fonts/stroke animations/audio/practice sheets | **Partial** — Font Architect exists, but no per-course content config |

#### 4. Payments & Billing
| Feature | Status |
|---------|--------|
| Configure subscription billing | **Missing** — No subscription system |
| View institute payments | **Partial** — Payments page exists but not org-scoped |
| Manage coupons globally | **Missing** — No coupon system |

#### 5. Analytics & Reports
| Feature | Status |
|---------|--------|
| Platform analytics | **Partial** — Basic stat cards on Reports page |
| Institute performance reports | **Missing** — No per-org analytics |
| Revenue dashboard | **Missing** — No revenue charts |
| Student performance trends | **Missing** — No student progress tracking |

#### 6. Security & System
| Feature | Status |
|---------|--------|
| Activity logs | **Missing** — login_attempts table exists but no UI |
| Data segregation monitoring | **Missing** |
| Backup control | **Missing** |
| Infrastructure monitoring | **Missing** |

---

### Implementation Plan (Priority Order)

**Phase 1 — Quick Wins (existing infrastructure gaps)**

1. **Enable/disable organizations** — Add `is_active` boolean column to `organizations` table; add toggle in OrganizationsPage UI
2. **Create user from admin panel** — Add a "Create User" dialog in UsersPage that calls an edge function to create auth user + assign role + org
3. **Deactivate users** — Add `is_active` column to `profiles`; soft-delete instead of hard-delete
4. **Admin password reset** — Add edge function using service role to trigger password reset email
5. **Activity logs page** — Create UI to display `login_attempts` table data; extend with a general `activity_logs` table

**Phase 2 — Analytics & Revenue**

6. **Revenue dashboard** — Add revenue charts to Reports page using payments data (monthly totals, by-org breakdown)
7. **Institute performance reports** — Aggregate courses, students, payments per organization
8. **Student performance trends** — Track attendance rates, course completion (requires new `student_progress` table)

**Phase 3 — Billing & Advanced Features**

9. **Subscription plans** — Create `subscription_plans` and `org_subscriptions` tables; management UI
10. **Coupon system** — Create `coupons` table with discount logic
11. **White-label branding** — Add `branding` JSONB column to organizations (logo, colors, name)
12. **Curriculum structure** — Add `course_modules` and `lessons` tables for hierarchical content

**Phase 4 — Security & Monitoring**

13. **Activity logs (extended)** — Create `audit_logs` table with triggers on key tables
14. **System monitoring page** — Show storage usage, user counts, API health status

### Database Changes Required
- `organizations`: add `is_active` (boolean, default true), `branding` (jsonb)
- `profiles`: add `is_active` (boolean, default true)
- New tables: `subscription_plans`, `org_subscriptions`, `coupons`, `audit_logs`, `course_modules`, `student_progress`

### Approach
All admin operations will continue using the existing `admin-query` edge function pattern (service role key, action-based routing). New pages will be added to the navigation config with `superadmin` role restriction.

