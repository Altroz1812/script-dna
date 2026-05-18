import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  setActiveOrg: (id: string | null, name?: string | null) => void;
  clearActiveOrg: () => void;
}

const STORAGE_KEY = 'aurapen.active_org';
const STORAGE_NAME_KEY = 'aurapen.active_org_name';

const ActiveOrgContext = createContext<ActiveOrgState | null>(null);

export function ActiveOrgProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
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
  const [orgsLoading, setOrgsLoading] = useState<boolean>(false);

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
    setActiveOrgId(id);
    setActiveOrgName(name ?? (id === null ? 'Global view' : null));
    window.localStorage.setItem(STORAGE_KEY, id === null ? '__global__' : id);
    window.localStorage.setItem(STORAGE_NAME_KEY, name ?? (id === null ? 'Global view' : ''));
  }, [availableOrgs, profile?.role]);

  const clearActiveOrg = useCallback(() => {
    setActiveOrgId(undefined);
    setActiveOrgName(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_NAME_KEY);
  }, []);

  // Load the list of orgs the user belongs to. SuperAdmin loads all.
  useEffect(() => {
    let alive = true;
    if (!session?.user || !profile) { setAvailableOrgs([]); return; }
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
        if (alive) setOrgsLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, profile?.role]);

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
    <ActiveOrgContext.Provider value={{ activeOrgId, activeOrgName, availableOrgs, orgsLoading, setActiveOrg, clearActiveOrg }}>
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