

## Fix: Default Attendance to "Absent" in End-Class Dialog

### Problem
When a teacher ends a class via the "End Class & Save Attendance" dialog, all enrolled students default to "Present" — even those who never joined. This produces inaccurate attendance records.

### Root Cause
In `EndClassAttendanceDialog.tsx`, line `studs.forEach(s => { rec[s.student_id] = 'present'; });` defaults every student to present. The teacher must manually switch non-attendees to absent, which is error-prone.

### Fix

**Update `src/components/classroom/EndClassAttendanceDialog.tsx`**
- Change the default status from `'present'` to `'absent'` when populating the records
- This way the teacher only marks students who actually attended as "Present", rather than having to remember who was absent

**Update `src/pages/AttendancePage.tsx`**
- Same fix: change default from `'present'` to `'absent'` in the manual attendance page for consistency

### What Stays the Same
- The database trigger `auto_mark_attendance_on_class_end` uses `ON CONFLICT DO NOTHING`, so it won't overwrite the manually saved records since they're inserted first
- The save flow (delete existing + insert new records) remains unchanged

### Files
| File | Action |
|------|--------|
| `src/components/classroom/EndClassAttendanceDialog.tsx` | Update — default to `'absent'` |
| `src/pages/AttendancePage.tsx` | Update — default to `'absent'` |

