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
