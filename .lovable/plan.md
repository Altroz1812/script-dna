

## Completed: Offline + Online Course Mode

### What Was Implemented
1. **Database**: Added `delivery_mode` (default 'online') and `center` columns to courses table
2. **Edge Function**: Updated `create_course` with new fields, added `update_course` action, updated `list_batches` and `list_live_classes` to include delivery_mode
3. **CoursesPage**: Refactored with tabs (All/Online/Offline), edit dialog, delivery mode radio + conditional center field, extracted CourseForm component
4. **LiveClassesPage**: Offline courses show "Offline — Manual Attendance" badge instead of Start/Join buttons
5. **BatchesPage**: Shows Online/Offline badge per batch
6. **courseService.ts**: Added `delivery_mode`, `center` fields and `updateCourse()` method
