import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { MobileTopBar } from './MobileTopBar';
import { MobileBottomTabs } from './MobileBottomTabs';
import { MobileDrawer } from './MobileDrawer';
import { OfflineBanner } from './ui/OfflineBanner';

export function MobileAppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OfflineBanner />
      <MobileTopBar onOpenMenu={() => setDrawerOpen(true)} />
      <main
        className="flex-1 min-h-0 relative"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        <Outlet />
      </main>
      <MobileBottomTabs />
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}