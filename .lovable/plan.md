## Goal
Resolve the production `admin-query` 403 loop on `aurapen.com` where the frontend identifies the user as `superadmin`, but the backend function treats the same request as a non-SuperAdmin and rejects the selected organization.

## Diagnosis from the current code
- The dashboard is sending `target_org_id: '36e40e42-c17d-4ea9-bb74-625d85014450'` while `isSuperadmin: true`.
- In `supabase/functions/admin-query/index.ts`, that request should only be rejected with `Forbidden: organization not accessible` if the function fails to resolve the caller as SuperAdmin.
- Therefore the likely failure is in the edge function identity/role resolution path, not in the dashboard visual refactor:
  - missing/invalid Authorization token in deployed Vercel function calls, or
  - backend role lookup not matching the frontend profile role, or
  - frontend is issuing tenant-scoped queries before auth/session/org state is fully ready.

## Implementation plan

1. Harden `admin-query` authentication and role resolution
   - Require a valid user token for all privileged/admin actions instead of silently falling back to anonymous behavior.
   - Normalize role checks defensively and treat SuperAdmin consistently from `user_roles`.
   - Return clearer 401/403 errors so future logs distinguish:
     - missing auth token
     - invalid auth token
     - user has no role
     - org not accessible

2. Add safe diagnostic logging inside `admin-query`
   - Log action, whether a token was present, resolved caller user id, resolved roles, `requestedOrgId`, and final `targetOrgId`.
   - Avoid logging secrets or raw JWTs.
   - This will make Vercel/production failures traceable without exposing sensitive data.

3. Fix client-side request timing and tenant scope
   - In `Dashboard.tsx`, prevent SuperAdmin org-scoped stats queries until `activeOrgId` has resolved through `ActiveOrgContext`.
   - Remove the temporary `Dashboard Debug` console logs from production code.
   - Ensure SuperAdmin global view still sends `target_org_id: null`, while selected-org view sends the selected org id.

4. Align admin service auth behavior
   - Update `src/services/api/adminService.ts` so every `adminQuery` waits for a valid session before invoking the function.
   - If no session exists, throw a clear local auth error instead of sending a request that the backend interprets as non-SuperAdmin.
   - Keep the stale-org localStorage protection added earlier.

5. Validate after implementation
   - Test `admin-query` for `get_stats`, `list_courses`, and `list_batches` with the selected org flow.
   - Check recent function logs for the resolved role and target org.
   - Verify `/dashboard`, `/courses`, and `/batches` no longer create repeated 403 retries for SuperAdmin on the production-equivalent flow.

## Files expected to change
- `supabase/functions/admin-query/index.ts`
- `src/services/api/adminService.ts`
- `src/pages/Dashboard.tsx`

## Expected outcome
SuperAdmin requests from `aurapen.com` will be authenticated and recognized correctly by the backend function, selected organization scope will be honored, and the dashboard/course/batch queries will stop looping with `Forbidden: organization not accessible`.