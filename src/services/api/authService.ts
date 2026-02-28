import { supabase } from '@/integrations/supabase/client';

const FETCH_TIMEOUT_MS = 10000; // 10 second timeout per attempt

// Wrapper that adds a timeout to fetch to prevent indefinite hangs
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

// Retry helper for transient network failures
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 800): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isNetworkError =
        err?.message === 'Failed to fetch' ||
        err?.name === 'TypeError' ||
        err?.name === 'AbortError';
      if (isNetworkError && attempt < retries) {
        console.warn(`[Auth] Attempt ${attempt + 1} failed, retrying in ${delayMs * (attempt + 1)}ms...`);
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await withRetry(() =>
      supabase.auth.signInWithPassword({ email, password })
    );
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string) {
    const { data, error } = await withRetry(() =>
      supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
    );
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
