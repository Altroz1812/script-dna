import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { getNavigationForRole } from "@/config/navigation";
import aurapenLogo from "/favicon.png";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ROLE_LABELS } from "@/types/roles";

export function AppSidebar() {
  const { profile, loading } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  if (loading || !profile) return <Skeleton />;

  return (
    <Sidebar collapsible="icon">
      <Header collapsed={collapsed} role={profile.role} />
      <SidebarContent className="px-2 py-1 overflow-y-auto" id="sidebar-scroll-container">
        {getNavigationForRole(profile.role).map((group) => (
          <CollapsibleGroup key={group.label} group={group} collapsed={collapsed} pathname={location.pathname} />
        ))}
      </SidebarContent>
      {!collapsed && <Footer />}
      <SidebarRail />
    </Sidebar>
  );
}

function Skeleton() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-white/[0.08] p-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.08] animate-pulse" />
      </SidebarHeader>
      <SidebarContent className="px-3 py-2 space-y-1.5">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-7 rounded-md bg-white/[0.04] animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

function Header({ collapsed, role }: { collapsed: boolean; role: string }) {
  return (
    <SidebarHeader className="border-b border-white/[0.08] p-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/10">
          <img src={aurapenLogo} alt="AuraPen" className="w-full h-full object-contain" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">AuraPen</h2>
            <p className="text-[10px] text-muted-foreground/60 truncate">
              {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
            </p>
          </div>
        )}
      </div>
    </SidebarHeader>
  );
}

function Footer() {
  return (
    <SidebarFooter className="border-t border-white/[0.08] py-2.5 px-3">
      <p className="text-[10px] text-muted-foreground/40 text-center">© 2026 AuraPen</p>
    </SidebarFooter>
  );
}

function CollapsibleGroup({
  group,
  collapsed,
  pathname,
}: {
  group: { label: string; items: any[] };
  collapsed: boolean;
  pathname: string;
}) {
  const [isOpen, setIsOpen] = useState(() =>
    group.items.some((item) => pathname === item.url || pathname.startsWith(item.url + "/")),
  );

  const groupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(isOpen);

  useEffect(() => {
    // Only scroll when opening (not on mount or close)
    if (isOpen && !wasOpen.current) {
      const timer = setTimeout(() => {
        const scrollContainer = document.getElementById("sidebar-scroll-container");
        const groupElement = groupRef.current;

        if (!scrollContainer || !groupElement) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        const groupRect = groupElement.getBoundingClientRect();

        // Calculate group bottom position relative to container
        const groupBottom = groupRect.bottom;
        const containerBottom = containerRect.bottom;

        // If group extends below visible area
        if (groupBottom > containerBottom) {
          const scrollAmount = groupBottom - containerBottom + 20; // 20px buffer
          scrollContainer.scrollBy({
            top: scrollAmount,
            behavior: "smooth",
          });
        }

        // If group top is above visible area
        if (groupRect.top < containerRect.top) {
          const scrollAmount = groupRect.top - containerRect.top - 20;
          scrollContainer.scrollBy({
            top: scrollAmount,
            behavior: "smooth",
          });
        }
      }, 250);

      return () => clearTimeout(timer);
    }

    wasOpen.current = isOpen;
  }, [isOpen]);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  if (collapsed) {
    return (
      <>
        {group.items.map((item) => (
          <SidebarMenu key={item.url}>
            <MenuItem item={item} collapsed isActive={pathname === item.url || pathname.startsWith(item.url + "/")} />
          </SidebarMenu>
        ))}
      </>
    );
  }

  return (
    <div ref={groupRef} className="mb-0.5">
      <button
        onClick={toggle}
        className={cn(
          "flex items-center w-full gap-2 px-1.5 py-1.5 -mx-1 rounded-md",
          "text-[12px] font-semibold text-muted-foreground/80",
          "hover:text-foreground hover:bg-white/[0.04] transition-colors",
          "tracking-wide uppercase",
          isOpen && "text-foreground/90",
        )}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen && "rotate-90")} />
        {group.label}
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div ref={contentRef} className="overflow-hidden">
          <SidebarMenu className="mt-0.5 mb-1">
            {group.items.map((item) => (
              <MenuItem
                key={item.url}
                item={item}
                collapsed={false}
                isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
              />
            ))}
          </SidebarMenu>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ item, collapsed, isActive }: { item: any; collapsed: boolean; isActive: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={collapsed ? item.title : undefined}>
        <NavLink
          to={item.url}
          end
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 text-[13px] rounded-md transition-all duration-150",
            collapsed ? "justify-center px-1.5" : "pl-5",
            isActive
              ? "bg-primary/8 text-primary font-medium"
              : "text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.04]",
          )}
        >
          <item.icon className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-3.5 w-3.5")} />
          {!collapsed && <span className="truncate">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
