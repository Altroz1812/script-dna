import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
// Import your Tenant context hook here (modify path if it lives inside AuthContext)
// import { useTenant } from '@/contexts/TenantContext';
import { getNavigationForRole } from "@/config/navigation";
import aurapenLogo from "/favicon.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  const { profile, loading, activeOrgId, availableOrgs, setActiveOrgId } = useAuth(); // Assuming these are in useAuth or useTenant
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  // Don't render nav until profile is loaded to avoid defaulting to 'student'
  if (loading || !profile) {
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-white/[0.08] px-3 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-primary/30 ring-2 ring-primary/20 animate-pulse">
              <img src={aurapenLogo} alt="AuraPen" className="w-full h-full object-contain" />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="py-2">
          <div className="space-y-3 px-3 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
    );
  }

  const role = profile.role;
  const navGroups = getNavigationForRole(role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-white/[0.08] px-3 py-4 flex flex-col gap-3">
        {/* Profile Branding Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-primary/30 ring-2 ring-primary/20">
            <img src={aurapenLogo} alt="AuraPen" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h2 className="font-semibold text-sm text-gradient font-display truncate">AuraPen</h2>
              <p className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[role]}</p>
            </div>
          )}
        </div>

        {/* Dynamic Multi-Tenant Workspace Switcher Dropdown */}
        {!collapsed && availableOrgs && availableOrgs.length > 1 && (
          <div className="w-full px-0.5 pt-1 animate-fadeIn">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold block mb-1">
              Active Workspace
            </label>
            <select
              value={activeOrgId || ""}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="w-full text-xs font-medium bg-white/[0.03] hover:bg-white/[0.06] text-foreground border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer"
            >
              {availableOrgs.map((org: any) => (
                <option key={org.id} value={org.id} className="bg-slate-900 text-white">
                  {org.name || "Unnamed Tenant"}
                </option>
              ))}
            </select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          end
                          className={`relative transition-all duration-200 rounded-lg ${
                            isActive
                              ? "bg-primary/15 text-primary font-medium shadow-sm shadow-primary/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                          }`}
                          activeClassName=""
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-primary to-coral shadow-sm shadow-primary/40" />
                          )}
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                          {isActive && !collapsed && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/[0.08] p-3">
        {!collapsed && <p className="text-[10px] text-muted-foreground/50 text-center">© 2026 AuraPen</p>}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
