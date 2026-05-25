import { useEffect, useState } from 'react';

// Treat phones AND tablets as the native mobile shell.
// 1024px keeps iPad portrait (768) and landscape (1024) in mobile mode,
// while desktops at >=1025 keep the full sidebar layout.
const BREAKPOINT = 1025;

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