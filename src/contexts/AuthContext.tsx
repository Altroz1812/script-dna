import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile, AppRole } from "@/types/roles";

interface DashboardContext {
  stats: Record<string, number>;
}

// Structuring an easy-to-use tenant data object
interface TenantOrg {
  id: string;
  name: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  dashboardContext: DashboardContext | null;
  loading: boolean;
  // Multi-tenant extensions
  activeOrgId: string | null;
  availableOrgs: TenantOrg[];
  setActiveOrgId: (id: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AUTH_CTX_KEY = "__auth_context__";
if (!(window as any)[AUTH_CTX_KEY]) {
  (window as any)[AUTH_CTX_KEY] = createContext<AuthContextValue | null>(null);
}
const AuthContext = (window as any)[AUTH_CTX_KEY] as React.Context<AuthContextValue | null>;

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Clean data fetcher wrapping profile details, application roles, and multi-tenant links
async function fetchProfileAndTenants(userId: string): Promise<{
  profile: UserProfile | null;
  orgs: TenantOrg[];
} | null> {
  const [profileRes, roleRes, membershipsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    supabase.from("user_roles").select("role").eq("user_id", userId).single(),
    supabase
      .from("organization_members")
      .select(
        `
        organization_id,
        organizations:organization_id (
          id,
          name
        )
      `,
      )
      .eq("user_id", userId),
  ]);

  if (profileRes.error || !profileRes.data) return null;

  // Format array maps with extensive fallbacks to avoid blank elements
  const orgs: TenantOrg[] = [];
  if (membershipsRes.data) {
    membershipsRes.data.forEach((row: any) => {
      if (row.organizations) {
        // Handle single object return
        orgs.push({
          id: (row.organizations as any).id,
          name: (row.organizations as any).name || "Unnamed Organization",
        });
      } else if (Array.isArray(row.organizations) && row.organizations.length > 0) {
        // Handle array variant return nested by client libraries
        orgs.push({
          id: row.organizations[0].id,
          name: row.organizations[0].name || "Unnamed Organization",
        });
      }
    });
  }

  const p = profileRes.data;
  const userProfile: UserProfile = {
    id: p.user_id,
    email: p.email ?? "",
    displayName: p.display_name ?? p.email ?? "",
    avatarUrl: p.avatar_url ?? undefined,
    organizationId: p.organization_id ?? undefined,
    role: (roleRes.data?.role as AppRole) ?? "student",
  };

  return { profile: userProfile, orgs };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardContext] = useState<DashboardContext | null>({ stats: {} });

  // Multi-Tenant States
  const [availableOrgs, setAvailableOrgs] = useState<TenantOrg[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  const loadProfileAndTenants = useCallback(async (userId: string) => {
    const data = await fetchProfileAndTenants(userId);
    if (data) {
      setProfile(data.profile);
      setAvailableOrgs(data.orgs);

      // Keep track of the active organizational boundary selection
      const savedOrgId = sessionStorage.getItem(`_active_org_${userId}`);
      if (savedOrgId && data.orgs.some((o) => o.id === savedOrgId)) {
        setActiveOrgId(savedOrgId);
      } else if (data.profile?.organizationId && data.orgs.some((o) => o.id === data.profile.organizationId)) {
        setActiveOrgId(data.profile.organizationId);
      } else if (data.orgs.length > 0) {
        setActiveOrgId(data.orgs[0].id);
      } else {
        setActiveOrgId(null);
      }
    } else {
      setProfile(null);
      setAvailableOrgs([]);
      setActiveOrgId(null);
    }
  }, []);

  // Update active context and pin to session storage to persist across screen refreshes
  const handleSetActiveOrgId = (id: string) => {
    setActiveOrgId(id);
    if (session?.user?.id) {
      sessionStorage.setItem(`_active_org_${session.user.id}`, id);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => loadProfileAndTenants(sess.user.id), 0);
      } else {
        setProfile(null);
        setAvailableOrgs([]);
        setActiveOrgId(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      if (sess?.user) {
        loadProfileAndTenants(sess.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfileAndTenants]);

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
    if (session?.user?.id) {
      sessionStorage.removeItem(`_active_org_${session.user.id}`);
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
    setAvailableOrgs([]);
    setActiveOrgId(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfileAndTenants(session.user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        dashboardContext,
        loading,
        activeOrgId,
        availableOrgs,
        setActiveOrgId: handleSetActiveOrgId,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
