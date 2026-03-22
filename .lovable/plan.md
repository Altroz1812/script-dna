

## Add Center/Branch Filter to Courses Page

### Overview
Add a dropdown filter that appears when viewing the "Offline" or "All" tabs, allowing any user (admin or public) to filter courses by branch/center location. The filter dynamically derives available centers from the loaded course data.

### Implementation

**Update `src/pages/CoursesPage.tsx`**

1. Add `selectedCenter` state (`string | 'all'`, default `'all'`)
2. Derive unique centers from courses: `const centers = [...new Set(courses.filter(c => c.center).map(c => c.center!))]`
3. Add a `Select` dropdown next to the tabs row with options: "All Branches" + each unique center
4. Apply the center filter to `offlineCourses` and the "all" list:
   - When `selectedCenter !== 'all'`, filter offline courses to match `c.center === selectedCenter`
   - Online courses are unaffected by the center filter
5. Reset `selectedCenter` to `'all'` when switching to the "online" tab
6. Show the filter on all tabs (it only affects offline courses, so online tab can hide it or grey it out)

**UI Layout**
```text
[Courses header]                    [New Course button]
[All | Online | Offline tabs]  [Branch: All Branches ▼]
[Course grid...]
```

The Select dropdown uses the existing `Select` component from `@/components/ui/select`. It shows a `MapPin` icon and displays center names. Visible to all users (admins, students, public visitors).

### Files
| File | Action |
|------|--------|
| `src/pages/CoursesPage.tsx` | **Update** — add center filter state, Select dropdown, filtered lists |

