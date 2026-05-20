# Plan: OAuth 404 + Parent-Only Checkout

## Issue 1 — Google Sign-In 404 at `www.aurapen.com/~oauth/initiate`

The `/~oauth/initiate` path is handled by Lovable's hosting proxy worker, not by app code. A 404 there means the custom domain `www.aurapen.com` is not properly wired to this Lovable project (DNS misconfigured, custom domain not active, or pointing to the wrong project).

Per Lovable guidance, this is **not** fixed by editing redirect URIs, callback URLs, or the `lovable.auth.signInWithOAuth` call — the code is already correct (it works on `*.lovable.app`).

### Action (user-side, no code change)
1. Open Lovable → Project Settings → Custom Domain and confirm `www.aurapen.com` shows "Active" / "Verified".
2. If not active, fix DNS (CNAME → `*.lovable.app` target shown in settings) and wait for verification.
3. Re-publish the project after the domain is active.
4. Retest Google sign-in on `https://www.aurapen.com/checkout`.

If `id-preview--*.lovable.app` and `aurapen.lovable.app` both work but only `www.aurapen.com` 404s on `/~oauth/initiate`, it is purely a custom-domain/hosting configuration issue. I will not touch auth code for this.

---

## Issue 2 — Checkout & Payments restricted to `parent` role

Today: any signed-in user (student/teacher/admin/parent) can complete `/checkout`. Requirement:
- Only users with role `parent` may complete checkout and pay.
- Brand-new Google sign-ups → since `handle_new_user_role()` defaults new users to `student`, they cannot check out either. Newly created users coming through `/checkout` must be promoted to `parent` automatically (they are buying for a child).
- Existing users with a non-parent role (student/teacher/admin/etc.) → must be **blocked** at checkout with a clear message ("This account is registered as a {role}. Checkout is only available for parent accounts.") and a Sign-out / Switch-account option.

### Frontend changes — `src/pages/CheckoutPage.tsx`
1. Read `profile` from `useAuth()` alongside `session`.
2. After auth step, gate the flow:
   - If `profile.role === 'parent'` → proceed to Student Details (current behaviour).
   - If `profile.role !== 'parent'` AND the account already existed before this checkout → show a **blocking screen** (cannot proceed, with Sign out button).
   - If the account was *just created* in this checkout session (detected via a `justSignedUpForCheckout` flag set right after `signInWithOAuth` returns tokens) and role is `student` (default) → call edge function `promote-to-parent` to flip the role, then `refreshProfile()` and continue.
3. Disable the Next button on Sign-In step until role validation completes.

### New edge function — `supabase/functions/promote-to-parent/index.ts`
- Verifies JWT, gets `auth.uid()`.
- Uses service role to:
  - Confirm the user has *no* existing non-`parent`/non-`student` role AND was created within the last N minutes (safety: only promote freshly-created accounts).
  - `UPDATE user_roles SET role='parent' WHERE user_id=...` (or delete `student` row + insert `parent`).
- Returns `{ ok: true, role: 'parent' }` or `{ ok: false, reason }`.
- Registered in `supabase/config.toml` with default JWT verification.

### Payments page — `src/pages/PaymentsPage.tsx`
- "Pay Now" / record-payment UI for the parent role already exists (`isParent` branch). 
- For non-parent + non-admin roles (e.g. student), hide the "Pay Now" button and show only their own payment history (read-only). Admin/superadmin/support keep existing capabilities.

### Cart entry points
- `BatchPickerDialog` / landing "Add to Cart" — no change to the add flow itself. The role gate lives at `/checkout`, so non-parent users can still browse but get blocked at the checkout gate with the explanatory message above.

---

## Out of scope
- The `.lovable/plan.md` enterprise refactor (still parked).
- Any change to admin/teacher/student dashboards beyond hiding "Pay Now" for non-parent students on the Payments page.
- Schema changes other than the role flip done inside the edge function.

## Verification
1. Publish + confirm custom domain active → Google sign-in on `www.aurapen.com/checkout` succeeds (no 404).
2. New Google user signs up via `/checkout` → role auto-promoted to `parent`, checkout proceeds.
3. Existing `student@demo.com` opens `/checkout` after login → sees blocked screen, cannot reach Payment step.
4. Existing `parent@demo.com` → checkout works end-to-end.
5. Admin / Teacher logging in → unaffected on every other page.
