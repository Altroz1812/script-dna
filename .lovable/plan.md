

# Plan: Course Catalog with Auto-Scheduling

## Overview
Enhance the `courses` table with structured metadata (grade level, duration, total hours, daily session length), seed the 9 predefined courses, and upgrade the Schedule page so that selecting a batch (linked to a course) auto-generates daily schedule entries spanning the full course duration.

## 1. Database Migration

Add new columns to the `courses` table:

```text
courses table additions:
  - grade_level     TEXT          (e.g. "UKG, 1st, 2nd")
  - duration_days   INTEGER       (e.g. 30 for one month, 60 for two months)
  - total_hours     INTEGER       (e.g. 25, 45, 30)
  - daily_hours     NUMERIC(3,1)  (e.g. 1.0)
  - language        TEXT          (e.g. "English", "Hindi", "Kannada")
  - writing_style   TEXT          (e.g. "Cursive", "Print", "Calligraphy")
  - includes_speed  BOOLEAN       DEFAULT false
```

Then insert the 9 courses as seed data in the same migration:

| # | Name | Language | Style | Speed | Grade | Days | Hours |
|---|------|----------|-------|-------|-------|------|-------|
| 1 | English Cursive Handwriting | English | Cursive | No | UKG, 1st, 2nd | 30 | 25 |
| 2 | English Cursive Handwriting & Speedwriting | English | Cursive | Yes | 3rd+ | 60 | 45 |
| 3 | English Print Handwriting | English | Print | No | UKG, 1st, 2nd | 30 | 25 |
| 4 | English Print Handwriting & Speedwriting | English | Print | Yes | 3rd+ | 60 | 45 |
| 5 | Hindi Handwriting | Hindi | Hindi | No | 1st, 2nd, 3rd | 30 | 25 |
| 6 | Hindi Handwriting & Speedwriting | Hindi | Hindi | Yes | 4th+ | 60 | 45 |
| 7 | Kannada Handwriting | Kannada | Kannada | No | 1st, 2nd, 3rd | 30 | 25 |
| 8 | Kannada Handwriting & Speedwriting | Kannada | Kannada | Yes | 4th+ | 60 | 45 |
| 9 | Calligraphy | English | Calligraphy | No | 3rd+ | 30 | 30 |

The `created_by` column will use the existing superadmin UUID.

## 2. Update Course Service & Types

Update the `Course` interface in `src/services/api/courseService.ts` to include the new fields. Update `createCourse` to accept the new parameters.

## 3. Update Courses Page

Display the new metadata on course cards (grade level, duration, total hours, language badge). Update the "Create Course" dialog to include fields for the new metadata.

## 4. Auto-Schedule on the Schedule Page

This is the key feature. Rework the Schedule creation flow:

- **New form fields**: Start date (date picker), select working days (checkboxes for Mon-Sat), time slot (start/end time), room
- **Auto-generation logic** (frontend): When user picks a batch + start date + working days + time:
  1. Look up the batch's course to get `duration_days` (working days count) and `daily_hours`
  2. Generate schedule entries: iterate from start date, skipping non-working days, until `duration_days` sessions are created
  3. Each entry gets: batch_id, title (course name), day_of_week, start_time, end_time, room, plus a new `date` column
- **Add `date` column** to `schedules` table (nullable DATE) to support specific-date scheduling alongside the existing recurring day_of_week pattern

- **New admin-query action** `bulk_create_schedules`: accepts an array of schedule entries and inserts them all at once

## 5. Edge Function Updates

- Update `create_course` action to handle new columns
- Add `bulk_create_schedules` action for batch insertion
- Update `list_courses` to return new fields

## Technical Details

### Migration SQL (summary)
- ALTER TABLE courses ADD COLUMN for each new field
- INSERT 9 seed courses
- ALTER TABLE schedules ADD COLUMN date DATE (nullable, for specific-date entries)
- Update `recompute_dashboard_stats` trigger (no change needed, already counts courses)

### Files to modify
1. **New migration** - schema changes + seed data
2. `src/services/api/courseService.ts` - updated Course interface and createCourse params
3. `src/pages/CoursesPage.tsx` - show metadata, updated create dialog
4. `src/pages/SchedulePage.tsx` - auto-schedule form with date picker, working days selector, bulk generation logic
5. `supabase/functions/admin-query/index.ts` - update create_course, add bulk_create_schedules

