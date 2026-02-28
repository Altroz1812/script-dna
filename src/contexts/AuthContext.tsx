import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { authService } from '@/services/api/authService';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/types/roles';

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

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function fetchLoginProfile(accessToken: string): Promise<{ profile: UserProfile; dashboard: DashboardContext } | null> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
    );
    const fetchPromise = supabase.functions.invoke('fast-login-profile', { body: {} });
    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('fast-login-profile failed (non-blocking):', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dashboardContext, setDashboardContext] = useState<DashboardContext | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileFast = useCallback((accessToken: string) => {
    // Fire-and-forget: never blocks auth flow
    fetchLoginProfile(accessToken).then(result => {
      if (result) {
        setProfile(result.profile);
        setDashboardContext(result.dashboard);
      }
    });
  }, []);

  useEffect(() => {
    // 1. Set up listener FIRST (prevents race condition)
    const { data: { subscription } } = authService.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (newSession?.access_token) {
          loadProfileFast(newSession.access_token);
        } else {
          setProfile(null);
          setDashboardContext(null);
        }
        setLoading(false);
      }
    );

    // 2. THEN check existing session
    authService.getSession().then((s) => {
      setSession(s);
      if (s?.access_token) {
        loadProfileFast(s.access_token);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfileFast]);

  const signIn = async (email: string, password: string) => {
    await authService.signIn(email, password);
  };

  const signUp = async (email: string, password: string) => {
    await authService.signUp(email, password);
  };

  const signOut = async () => {
    await authService.signOut();
    setProfile(null);
    setDashboardContext(null);
  };

  const refreshProfile = async () => {
    if (session?.access_token) loadProfileFast(session.access_token);
  };

  return (
    <AuthContext.Provider value={{ session, profile, dashboardContext, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
