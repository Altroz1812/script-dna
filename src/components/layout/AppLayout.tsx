import { Outlet } from "react-router-dom";
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { GlobalClassroomOverlay } from '@/components/classroom/GlobalClassroomOverlay';

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-6 overflow-auto relative morphing-gradient">
            <Outlet />
          </main>
        </div>
      </div>
      <GlobalClassroomOverlay />
    </SidebarProvider>
  );
}
