

# Fix: Eliminate Fetch Bottleneck in Preview Proxy

## Root Cause

The edge function itself is fast (responds in <1s when called directly). The problem is in `adminService.ts`:

1. **Dynamic import overhead**: `getAccessToken()` does `await import('@/integrations/supabase/client')` on EVERY request, which initializes the Supabase JS client and triggers its own background auth/session requests through the same proxy
2. **Competing requests**: Multiple pages fire simultaneous `adminQuery` calls (BatchesPage fires 2, student dialogs fire 3), all competing for the preview proxy's limited bandwidth
3. **10-second timeout too short**: The preview proxy adds latency; combined with cold starts and competing requests, 10s isn't enough

## Changes

### 1. Simplify `src/services/api/adminService.ts`

- Remove `getAccessToken()` entirely -- auth is mocked, the anon key is all that's needed
- Use the anon key directly as the bearer token (the edge function uses the service role key internally, so the bearer token is only for gateway auth)
- Increase timeout from 10s to 30s
- Add a simple sequential request queue so requests don't flood the proxy simultaneously

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let pending: Promise<any> = Promise.resolve();

export async function adminQuery(action: string, params: any = {}) {
  // Queue requests sequentially to avoid flooding the proxy
  const result = pending.then(() => doFetch(action, params));
  pending = result.catch(() => {});
  return result;
}

async function doFetch(action: string, params: any) {
  let lastError: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action, params }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err.name === 'AbortError' ? new Error('Request timed out') : err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}
```

Key improvements:
- No more dynamic imports (eliminates Supabase client initialization overhead)
- Sequential queue prevents proxy flooding
- 30s timeout handles slow proxy gracefully
- Longer retry delays (1s, 2s) give the proxy time to recover

### 2. No edge function changes needed

The edge function is already correct and fast. CORS headers are properly configured. No redeployment needed.

## Expected Result

- Pages load reliably without "Failed to fetch" errors
- No more competing requests overwhelming the preview proxy
- Eliminates the Supabase client initialization overhead on every API call

