# Plan: Logo Upload Confirmation + Responsive Logo Display

Two focused improvements to `src/pages/OrganizationsPage.tsx`. No DB or edge function changes required (the `org-logos` bucket and `update_org_branding` mirror logic are already in place).

## 1. Upload + Save confirmation & error state

### Upload step (file → Supabase Storage)
- Replace the current single toast with explicit lifecycle feedback in `handleLogoUpload`:
  - On start: `toast.loading('Uploading logo…', { id })`
  - On success: dismiss loading, show `toast.success('Logo uploaded to storage')` with the file size + bucket path as description
  - On failure: dismiss loading, show `toast.error('Logo upload failed')` with the underlying message as description
- Add an HTTP HEAD verification on the returned `publicUrl` before declaring success — catches bucket-not-public or RLS misconfigurations immediately.
- Track upload errors in new state `logoUploadError: string | null` and render an inline red helper line under the upload row when set (in addition to the toast). Cleared on next attempt or successful upload.
- Visual state on the preview tile while uploading: dashed ring + spinner overlay.

### Save step (branding → DB)
- Refactor the inline Save handler into a named `handleSaveBranding` async function with a guarded `saving` state to disable the button + show spinner.
- After `update_org_branding` resolves, re-fetch the org row and verify `logo_url` matches what was sent:
  - Match → `toast.success('Branding saved', { description: 'Logo is now live on the organization card.' })`
  - Mismatch → `toast.error('Branding partially saved', { description: 'Logo URL did not persist. Please try again.' })` and keep dialog open.
- Reuse the existing diff-style pattern already used in `CoursesPage` for consistency.

## 2. Responsive logo display with consistent aspect ratio + auto crop

Standardize logos across the app to a square 1:1 frame with smart cropping so logos look correct regardless of source dimensions.

### Card thumbnail (org list)
- Replace the current `h-10 w-10 object-contain` with a square responsive frame:
  - `aspect-square w-12 sm:w-14 shrink-0 rounded-lg overflow-hidden border border-border bg-gradient-to-br from-muted to-muted/50`
  - Inner `<img>` uses `h-full w-full object-cover object-center` for automatic cropping (fills frame, no letterboxing).
  - Add `loading="lazy"` and `decoding="async"`.
- Fallback tile (no logo) matches identical dimensions and uses the org's `branding.primary_color` as a subtle tint behind the `Building2` icon.
- Image error state: swap to fallback tile (instead of just hiding via visibility) so layout never collapses.

### Branding dialog preview
- Same aspect-square approach at `w-16` for the editor preview tile.
- Live preview row at the bottom uses `w-12 aspect-square object-cover` so users see exactly what cards will render.

### Why object-cover (auto crop) over object-contain
- Cards already enforce a uniform footprint; `object-contain` produces inconsistent visual weight when source logos are wide vs tall.
- `object-cover` + centered focal point gives a consistent, polished grid. Source logos with critical edge content remain visible in the larger dialog preview where users can verify before saving.

## Files touched
- `src/pages/OrganizationsPage.tsx` (only file)

## Out of scope
- No schema, RLS, edge function, or storage bucket changes.
- No changes to other pages that render org logos (can be migrated to the same pattern in a follow-up if desired).
