

# Fix: AuthProvider Ref Warning and Aborted Signal Error

## Problems Identified

1. **"Function components cannot be given refs"** -- The Lovable preview framework is passing a ref to `AuthProvider`. The fix is to wrap the component export with `React.forwardRef` so it can gracefully accept (and ignore) the ref.

2. **"signal is aborted without reason"** -- The `AbortController` timeout in `authService.ts` is firing before the request completes, or the component unmounts mid-request. The fetch calls need better abort handling.

## Changes

### 1. `src/contexts/AuthContext.tsx`
- Wrap `AuthProvider` with `React.forwardRef` so the preview framework's ref passes through without warnings
- The ref won't be used internally -- it just prevents the console error

```typescript
// Before
export function AuthProvider({ children }: { children: React.ReactNode }) {

// After  
export const AuthProvider = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  function AuthProvider({ children }, _ref) {
    // ... all existing logic stays the same
  }
);
```

### 2. `src/services/api/authService.ts`
- Remove or increase the `AbortController` timeout to prevent premature request cancellation
- Add proper error handling for aborted signals so they don't surface as unhandled errors

## Impact
- Eliminates both console warnings/errors
- No functional changes to auth flow
- Login behavior remains the same

