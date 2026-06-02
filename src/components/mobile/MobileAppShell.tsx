import { Outlet } from 'react-router-dom';
import { MobileTopBar } from './MobileTopBar';
import { MobileBottomTabs } from './MobileBottomTabs';
import { MobileDrawer } from './MobileDrawer';
import { OfflineBanner } from './ui/OfflineBanner';

export function MobileAppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OfflineBanner />
      <MobileTopBar />
      <main
        className="flex-1 min-h-0 relative"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        <Outlet />
      </main>
      <MobileBottomTabs />
      <MobileDrawer />
    </div>
  );
}