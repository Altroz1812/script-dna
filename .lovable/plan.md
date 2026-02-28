

# Fix: Edge Function Failures and Slow Loading

## Root Cause

Two issues are causing the "Failed to fetch" errors across all pages:

1. **Incomplete CORS headers** in the `admin-query` edge function. The current headers are missing several headers that the Supabase JS client sends (`x-supabase-client-platform`, `x-supabase-client-platform-version`, etc.). When the browser sends a preflight OPTIONS request, these missing headers cause the CORS check to fail, blocking the actual request.

2. **Too many simultaneous requests** from pages that fire multiple `adminQuery` calls in parallel on mount (e.g., Dashboard fires `get_stats`, BatchesPage fires both `list_courses` + `list_batches`). Combined with cold-start delays on the edge function, this creates a cascading failure pattern.

## Changes

### 1. Fix CORS headers in edge function

**File:** `supabase/functions/admin-query/index.ts`

Update the CORS headers to include all headers the Supabase JS client sends:

```text
Before:
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'

After:
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

### 2. Add retry logic to the admin service

**File:** `src/services/api/adminService.ts`

Wrap the `adminQuery` function with automatic retry (up to 2 retries with a short delay) so transient network failures from the preview proxy don't break the UI:

```typescript
export async function adminQuery(action: string, params: any = {}) {
  let lastError: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('admin-query', {
        body: { action, params },
      });
      if (error) throw error;
      return data;
    } catch (err) {
      lastError = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}
```

### 3. Deploy edge function

Redeploy the `admin-query` edge function after CORS fix.

## Expected Result

- CORS preflight requests will succeed, allowing actual data requests to go through
- Transient preview proxy failures will be automatically retried instead of showing errors
- Pages will load data reliably without "Failed to fetch" errors

