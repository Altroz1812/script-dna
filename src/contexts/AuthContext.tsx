import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile, AppRole } from '@/types/roles';

interface DashboardContext {
  stats: Record<string, number>;
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  dashboardContext: DashboardContext | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AUTH_CTX_KEY = '__auth_context__';
if (!(window as any)[AUTH_CTX_KEY]) {
  (window as any)[AUTH_CTX_KEY] = createContext<AuthContextValue | null>(null);
}
const AuthContext = (window as any)[AUTH_CTX_KEY] as React.Context<AuthContextValue | null>;

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const [profileRes, roleRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).single(),
    supabase.from('user_roles').select('role').eq('user_id', userId).single(),
  ]);

  if (profileRes.error || !profileRes.data) return null;

  const p = profileRes.data;
  return {
    id: p.user_id,
    email: p.email ?? '',
    displayName: p.display_name ?? p.email ?? '',
    avatarUrl: p.avatar_url ?? undefined,
    organizationId: p.organization_id ?? undefined,
    role: (roleRes.data?.role as AppRole) ?? 'student',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardContext] = useState<DashboardContext | null>({ stats: {} });

  const loadProfile = useCallback(async (userId: string) => {
    const p = await fetchProfile(userId);
    setProfile(p);
  }, []);

  useEffect(() => {
    // Heartbeat: ping every 60s while logged in so Active Users stays fresh.
    let heartbeatTimer: number | null = null;
    const startHeartbeat = () => {
      if (heartbeatTimer != null) return;
      const ping = () => { supabase.functions.invoke('heartbeat', { body: {} }).catch(() => {}); };
      ping();
      heartbeatTimer = window.setInterval(ping, 60_000);
    };
    const stopHeartbeat = () => {
      if (heartbeatTimer != null) { window.clearInterval(heartbeatTimer); heartbeatTimer = null; }
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setLoading(true);
      setSession(sess);
      if (sess?.user) {
        // Use setTimeout to avoid Supabase auth callback deadlocks, but keep
        // auth loading true until the role/profile has actually loaded.
        setTimeout(async () => {
          await loadProfile(sess.user.id);
          setLoading(false);
          startHeartbeat();
        }, 0);
      } else {
        setProfile(null);
        setLoading(false);
        stopHeartbeat();
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      setSession(sess);
      if (sess?.user) {
        await loadProfile(sess.user.id);
        startHeartbeat();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); stopHeartbeat(); };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Fire-and-forget audit log
    supabase.functions.invoke('record-login-attempt', {
      body: { email, success: !error, error_code: error?.message ?? null },
    }).catch(() => {});
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    // Best-effort: close server-side session row before token is dropped.
    try { await supabase.functions.invoke('heartbeat', { body: { end: true } }); } catch {}
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, profile, dashboardContext, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
