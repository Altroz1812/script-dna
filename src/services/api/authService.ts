import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Direct fetch to edge function — bypasses lovable.js proxy interception
async function authProxy(action: string, payload: Record<string, string>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await res.json();
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Auth request failed (${res.status})`);
  }
  return data;
}

export const authService = {
  async signIn(email: string, password: string) {
    const data = await authProxy('signInWithPassword', { email, password });
    // After proxy login, set the session client-side so onAuthStateChange fires
    if (data?.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }
    return data;
  },

  async signUp(email: string, password: string) {
    const data = await authProxy('signUp', {
      email,
      password,
      redirectTo: window.location.origin,
    });
    if (data?.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }
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
    await authProxy('resetPassword', {
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
  },

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
