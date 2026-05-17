import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  const currentProfileRequest = useRef(0);
  const loadedProfileUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const requestId = ++currentProfileRequest.current;
    const p = await fetchProfile(userId);
    if (requestId !== currentProfileRequest.current) return;
    loadedProfileUserId.current = userId;
    setProfile(p);
  }, []);

  useEffect(() => {
    let mounted = true;

    const applySession = async (sess: Session | null) => {
      if (!mounted) return;
      setSession((prev) => (prev?.access_token === sess?.access_token ? prev : sess));
      if (sess?.user) {
        if (loadedProfileUserId.current !== sess.user.id) {
          await loadProfile(sess.user.id);
        }
      } else {
        currentProfileRequest.current += 1;
        loadedProfileUserId.current = null;
        setProfile(null);
      }
      if (mounted) setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      applySession(sess);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'INITIAL_SESSION') return;
      setTimeout(() => applySession(sess), 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    currentProfileRequest.current += 1;
    loadedProfileUserId.current = null;
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
