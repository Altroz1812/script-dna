import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// undefined = never picked (must choose), null = explicit Global view, string = scoped org id
type OrgId = string | null | undefined;

export interface AvailableOrg { id: string; name: string }

interface ActiveOrgState {
  activeOrgId: OrgId;
  activeOrgName: string | null;
  availableOrgs: AvailableOrg[];
  orgsLoading: boolean;
  orgsReady: boolean;
  setActiveOrg: (id: string | null, name?: string | null) => void;
  clearActiveOrg: () => void;
}

const STORAGE_KEY = 'aurapen.active_org';
const STORAGE_NAME_KEY = 'aurapen.active_org_name';

const ActiveOrgContext = createContext<ActiveOrgState | null>(null);

export function ActiveOrgProvider({ children }: { children: React.ReactNode }) {
  const { session, profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeOrgId, setActiveOrgId] = useState<OrgId>(() => {
    if (typeof window === 'undefined') return undefined;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;
    if (raw === '__global__') return null;
    return raw;
  });
  const [activeOrgName, setActiveOrgName] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_NAME_KEY);
  });
  const [availableOrgs, setAvailableOrgs] = useState<AvailableOrg[]>([]);
  const [orgsLoading, setOrgsLoading] = useState<boolean>(true);
  // Tracks which user id the org list was last resolved for. Until this
  // matches the current session user, ProtectedRoute should treat org state
  // as "not yet known" (spinner), never as "user has zero orgs".
  const [orgsLoadedForUserId, setOrgsLoadedForUserId] = useState<string | null>(null);

  const setActiveOrg = useCallback((id: string | null, name?: string | null) => {
    // Validate against membership list before persisting. The validation only
    // runs after the membership list has loaded; first-paint single-org
    // auto-select still works because availableOrgs is empty at that moment.
    const isSuperadmin = profile?.role === 'superadmin';
    if (id !== null && availableOrgs.length > 0 && !isSuperadmin) {
      if (!availableOrgs.find((o) => o.id === id)) {
        toast.error('Selected organization is not available to your account');
        return;
      }
    }
    // Non-SuperAdmin must never see the "Global" view.
    if (id === null && !isSuperadmin) {
      toast.error('Global view is restricted to SuperAdmin');
      return;
    }
    setActiveOrgId(id);
    setActiveOrgName(name ?? (id === null ? 'Global view' : null));
    window.localStorage.setItem(STORAGE_KEY, id === null ? '__global__' : id);
    window.localStorage.setItem(STORAGE_NAME_KEY, name ?? (id === null ? 'Global view' : ''));
    // Wipe all cached server data so the next render fetches fresh data
    // scoped to the new organization. Critical to prevent showing stale
    // cross-tenant data after a switch.
    queryClient.clear();
    // Hard-navigate so any page using local state / useEffect (not React Query)
    // also remounts under the new tenant scope. Skip when this is the very
    // first selection (no previous org) to avoid an unnecessary refresh.
    const previous = window.localStorage.getItem('aurapen.active_org_prev');
    window.localStorage.setItem('aurapen.active_org_prev', id === null ? '__global__' : id);
    if (previous && previous !== (id === null ? '__global__' : id)) {
      window.location.assign('/dashboard');
    }
  }, [availableOrgs, profile?.role, queryClient]);

  const clearActiveOrg = useCallback(() => {
    setActiveOrgId(undefined);
    setActiveOrgName(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_NAME_KEY);
  }, []);

  // Load the list of orgs the user belongs to. SuperAdmin loads all.
  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    if (!session?.user || !profile) {
      setAvailableOrgs([]);
      setOrgsLoading(false);
      setOrgsLoadedForUserId(null);
      return;
    }
    // Reset readiness whenever the user changes, BEFORE any await, so
    // ProtectedRoute never sees a stale (loaded=true, orgs=[]) window from
    // a previous session.
    if (orgsLoadedForUserId !== session.user.id) {
      setOrgsLoadedForUserId(null);
    }
    setOrgsLoading(true);
    (async () => {
      try {
        if (profile.role === 'superadmin') {
          const { data } = await supabase
            .from('organizations').select('id, name').order('name');
          if (!alive) return;
          setAvailableOrgs((data ?? []) as AvailableOrg[]);
        } else {
          const { data } = await supabase
            .from('organization_members')
            .select('organization_id, organizations(id, name)')
            .eq('user_id', session.user.id);
          if (!alive) return;
          const orgs: AvailableOrg[] = [];
          for (const r of (data ?? []) as any[]) {
            if (r.organizations?.id) orgs.push({ id: r.organizations.id, name: r.organizations.name });
          }
          // Teachers may not be org_members yet but own batches in an org — include those too
          if (profile.role === 'teacher') {
            const { data: bs } = await supabase
              .from('batches')
              .select('organization_id, organizations(id, name)')
              .eq('teacher_id', session.user.id);
            for (const b of (bs ?? []) as any[]) {
              if (b.organizations?.id && !orgs.find(o => o.id === b.organizations.id)) {
                orgs.push({ id: b.organizations.id, name: b.organizations.name });
              }
            }
          }
          setAvailableOrgs(orgs);

          // Auto-select for single-org users
          if (orgs.length === 1 && activeOrgId === undefined) {
            setActiveOrgId(orgs[0].id);
            setActiveOrgName(orgs[0].name);
            window.localStorage.setItem(STORAGE_KEY, orgs[0].id);
            window.localStorage.setItem(STORAGE_NAME_KEY, orgs[0].name);
          }

          // Sanity check: if a stale activeOrgId is no longer in the user's
          // available orgs, clear it and force re-selection. Prevents seeing
          // an org after access has been revoked.
          if (
            typeof activeOrgId === 'string' &&
            orgs.length > 0 &&
            !orgs.find((o) => o.id === activeOrgId)
          ) {
            toast.error('Your access to the previously selected organization was revoked');
            setActiveOrgId(undefined);
            setActiveOrgName(null);
            window.localStorage.removeItem(STORAGE_KEY);
            window.localStorage.removeItem(STORAGE_NAME_KEY);
          }
        }
      } finally {
        if (alive) {
          setOrgsLoading(false);
          setOrgsLoadedForUserId(session.user.id);
        }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session?.user?.id, profile?.role]);

  // Keep localStorage in sync (for cross-tab signals to adminService param injection)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const raw = e.newValue;
        if (raw === null) setActiveOrgId(undefined);
        else if (raw === '__global__') setActiveOrgId(null);
        else setActiveOrgId(raw);
      }
      if (e.key === STORAGE_NAME_KEY) setActiveOrgName(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <ActiveOrgContext.Provider value={{
      activeOrgId,
      activeOrgName,
      availableOrgs,
      orgsLoading,
      orgsReady: !!session?.user && orgsLoadedForUserId === session.user.id,
      setActiveOrg,
      clearActiveOrg,
    }}>
      {children}
    </ActiveOrgContext.Provider>
  );
}

export function useActiveOrg() {
  const ctx = useContext(ActiveOrgContext);
  if (!ctx) throw new Error('useActiveOrg must be used within ActiveOrgProvider');
  return ctx;
}

// Helper readable from non-React modules (services). Returns string | null (org id or global)
// or undefined if no selection yet.
export function readActiveOrgFromStorage(): OrgId {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return undefined;
  if (raw === '__global__') return null;
  return raw;
}