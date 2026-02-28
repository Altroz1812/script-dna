import { supabase } from '@/integrations/supabase/client';

// Use the server-side auth proxy to bypass preview iframe fetch interception
async function authProxy(action: string, payload: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('auth-proxy', {
    body: { action, ...payload },
  });

  if (error) throw new Error(error.message || 'Auth request failed');
  if (data?.error) throw new Error(data.error);
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
