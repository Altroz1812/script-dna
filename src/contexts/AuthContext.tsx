import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { authService } from '@/services/api/authService';
import type { UserProfile } from '@/types/roles';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

// Direct fetch to fast-login-profile — bypasses lovable.js proxy
async function fetchLoginProfile(accessToken: string): Promise<{ profile: UserProfile; dashboard: DashboardContext } | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/fast-login-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('fast-login-profile failed:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dashboardContext, setDashboardContext] = useState<DashboardContext | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileFast = useCallback(async (accessToken: string) => {
    const result = await fetchLoginProfile(accessToken);
    if (result) {
      setProfile(result.profile);
      setDashboardContext(result.dashboard);
    } else {
      setProfile(null);
      setDashboardContext(null);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = authService.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.access_token) {
          await loadProfileFast(newSession.access_token);
        } else {
          setProfile(null);
          setDashboardContext(null);
        }
        setLoading(false);
      }
    );

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
    if (session?.access_token) await loadProfileFast(session.access_token);
  };

  return (
    <AuthContext.Provider value={{ session, profile, dashboardContext, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
