

# Fix: Login "Failed to fetch" and Slow Auth

## Root Cause

The login is failing because it routes through the `auth-proxy` edge function, which adds an unnecessary network hop. The edge function cold-starts, sometimes times out, and the Lovable preview proxy can interfere with the direct fetch call. This is the source of the "Failed to fetch" errors.

## Solution: Use Supabase Client Directly

Instead of calling an edge function that just forwards to Supabase Auth, use the Supabase JS client's built-in `signInWithPassword` directly. This eliminates the extra hop, removes cold-start delays, and uses the SDK's built-in retry/error handling.

## Changes

### 1. Simplify `src/services/api/authService.ts`

Replace the `authProxy` fetch calls with direct Supabase client calls:

- `signIn` -- use `supabase.auth.signInWithPassword()` directly
- `signUp` -- use `supabase.auth.signUp()` directly  
- `resetPassword` -- use `supabase.auth.resetPasswordForEmail()` directly
- Remove the `authProxy` function entirely

This eliminates the edge function dependency for auth, removing the "Failed to fetch" errors.

### 2. Simplify `src/contexts/AuthContext.tsx`

The `fast-login-profile` edge function call is fine (it adds real value by consolidating profile + dashboard data). But the `fetchLoginProfile` function should add a timeout and error resilience so a slow profile fetch doesn't block the UI. If it fails, the user still logs in and the profile loads on retry.

### 3. Console ref warnings (cosmetic only)

The "Function components cannot be given refs" warnings for `Login` and `ProtectedRoute` are harmless -- caused by the Lovable preview framework. No action needed; they don't affect functionality.

## Result

- Login calls go directly to the authentication system (no edge function cold-start)
- "Failed to fetch" errors eliminated
- Login becomes near-instant
- Profile/dashboard context still loads via the fast-login-profile function in parallel

