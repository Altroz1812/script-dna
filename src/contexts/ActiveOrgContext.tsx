import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// undefined = never picked (must choose), null = explicit Global view, string = scoped org id
type OrgId = string | null | undefined;

interface ActiveOrgState {
  activeOrgId: OrgId;
  activeOrgName: string | null;
  setActiveOrg: (id: string | null, name?: string | null) => void;
  clearActiveOrg: () => void;
}

const STORAGE_KEY = 'aurapen.active_org';
const STORAGE_NAME_KEY = 'aurapen.active_org_name';

const ActiveOrgContext = createContext<ActiveOrgState | null>(null);

export function ActiveOrgProvider({ children }: { children: React.ReactNode }) {
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

  const setActiveOrg = useCallback((id: string | null, name?: string | null) => {
    setActiveOrgId(id);
    setActiveOrgName(name ?? (id === null ? 'Global view' : null));
    window.localStorage.setItem(STORAGE_KEY, id === null ? '__global__' : id);
    window.localStorage.setItem(STORAGE_NAME_KEY, name ?? (id === null ? 'Global view' : ''));
  }, []);

  const clearActiveOrg = useCallback(() => {
    setActiveOrgId(undefined);
    setActiveOrgName(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_NAME_KEY);
  }, []);

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
    <ActiveOrgContext.Provider value={{ activeOrgId, activeOrgName, setActiveOrg, clearActiveOrg }}>
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