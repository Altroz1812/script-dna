const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function adminQuery(action: string, params: any = {}) {
  let lastError: any;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const token = (await getAccessToken()) || SUPABASE_ANON_KEY;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
      lastError = err;

      if (err.name === 'AbortError') {
        lastError = new Error('Request timed out');
      }

      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}
