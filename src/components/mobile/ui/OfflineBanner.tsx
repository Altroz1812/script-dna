import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="px-4 py-1.5 text-xs font-medium text-warning-foreground bg-warning/90 flex items-center justify-center gap-2">
      <WifiOff className="w-3.5 h-3.5" />
      You're offline — showing cached data
    </div>
  );
}