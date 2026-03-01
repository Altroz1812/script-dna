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

// Use a global singleton to survive HMR module duplication
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

// Mock profile that grants superadmin access to all modules
const mockProfile: UserProfile = {
  id: 'f07853ff-3fdc-401c-9424-3a6814a89ea4',
  email: 'superadmin@demo.com',
  displayName: 'Super Admin',
  avatarUrl: null,
  organizationId: null,
  role: 'superadmin',
};

// Fake session object so ProtectedRoute sees a truthy session
const mockSession = { access_token: 'dev-bypass', refresh_token: '', user: { id: 'f07853ff-3fdc-401c-9424-3a6814a89ea4', email: 'superadmin@demo.com' } } as unknown as Session;

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
