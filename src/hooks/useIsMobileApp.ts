import { useEffect, useState } from 'react';

const BREAKPOINT = 768;

function detect(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  return window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`).matches;
}

export function useIsMobileApp(): boolean {
  const [is, setIs] = useState<boolean>(() => detect());
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const onChange = () => setIs(detect());
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return is;
}