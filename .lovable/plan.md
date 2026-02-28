

# Rebuild Auth: Bulletproof Login Flow

## Root Cause

The "Failed to fetch" errors come from the Lovable preview proxy (`lovable.js`) intercepting `window.fetch`. This is intermittent and outside our control, but we can make auth resilient to it with automatic retries.

Additionally, the `AuthContext` has two bugs:
- An `AbortController` is created but never passed to the fetch call (does nothing)
- A race condition where `getSession()` can fire before `onAuthStateChange` is fully set up

## Plan

### 1. Rebuild `src/services/api/authService.ts` with retry logic

Add a `withRetry` wrapper that retries failed auth calls up to 3 times with exponential backoff (500ms, 1s, 2s). This handles the transient "Failed to fetch" from the preview proxy.

- `signIn` -- retries `supabase.auth.signInWithPassword()`
- `signUp` -- retries `supabase.auth.signUp()`
- `resetPassword` -- retries `supabase.auth.resetPasswordForEmail()`
- `signOut`, `updatePassword`, `getSession`, `onAuthStateChange` -- kept as-is (less prone to failure)

### 2. Rebuild `src/contexts/AuthContext.tsx`

- Remove the broken AbortController (it's not connected to anything)
- Fix the race condition: set up `onAuthStateChange` listener BEFORE calling `getSession()`
- Make profile loading non-blocking: if `fast-login-profile` fails, user still logs in and sees the app
- Don't `await` inside `onAuthStateChange` callback (prevents blocking auth event processing)

### 3. Rebuild `src/pages/Login.tsx`

- Better error messages: distinguish "Network error, please retry" from "Invalid credentials"
- Ensure the loading spinner clears on all code paths

### 4. Rebuild `src/pages/Signup.tsx`

- Same retry-aware error handling as Login
- Clear distinction between network failures and validation errors

## Technical Details

**Retry helper:**
```text
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === maxRetries - 1) throw err;
      if (err.message?.includes('Failed to fetch')) {
        await delay(500 * 2^i);   // exponential backoff
        continue;
      }
      throw err;  // non-network errors fail immediately
    }
  }
}
```

**AuthContext fix (race condition):**
```text
useEffect(() => {
  // 1. Set up listener FIRST
  const { data: { subscription } } = supabase.auth.onAuthStateChange(...)

  // 2. THEN check existing session
  supabase.auth.getSession().then(...)

  return () => subscription.unsubscribe();
}, []);
```

## Files Changed

| File | Action |
|------|--------|
| `src/services/api/authService.ts` | Add retry wrapper, rebuild all methods |
| `src/contexts/AuthContext.tsx` | Fix race condition, remove broken AbortController, non-blocking profile |
| `src/pages/Login.tsx` | Better error handling for network vs auth errors |
| `src/pages/Signup.tsx` | Same error handling improvements |

## Result

- Transient "Failed to fetch" errors are automatically retried (user never sees them)
- Auth state initializes correctly without race conditions
- Profile loading never blocks the login flow
- Clear error messages when something genuinely fails

