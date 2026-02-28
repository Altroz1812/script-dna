import React, { createContext, useContext, useState } from 'react';
import { Session } from '@supabase/supabase-js';
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

// Mock profile that grants superadmin access to all modules
const mockProfile: UserProfile = {
  id: 'dev-bypass',
  email: 'dev@local',
  displayName: 'Dev User',
  avatarUrl: null,
  organizationId: null,
  role: 'superadmin',
};

// Fake session object so ProtectedRoute sees a truthy session
const mockSession = { access_token: 'dev-bypass', refresh_token: '', user: { id: 'dev-bypass', email: 'dev@local' } } as unknown as Session;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session] = useState<Session | null>(mockSession);
  const [profile] = useState<UserProfile | null>(mockProfile);
  const [dashboardContext] = useState<DashboardContext | null>({ stats: {} });

  const noop = async () => {};

  return (
    <AuthContext.Provider value={{ session, profile, dashboardContext, loading: false, signIn: noop, signUp: noop, signOut: noop, refreshProfile: noop }}>
      {children}
    </AuthContext.Provider>
  );
}
