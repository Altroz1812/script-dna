import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Settings, User, Building2, Menu, X, ChevronDown } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveOrg } from "@/contexts/ActiveOrgContext";
import { getNavigationForRole } from "@/config/navigation";
import { ROLE_LABELS } from "@/types/roles";
import { TouchPress } from "./ui/TouchPress";
import { cn } from "@/lib/utils";

export function MobileDrawer() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const { activeOrgName } = useActiveOrg();
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // Initialize with groups expanded if they contain the active route
    if (!profile) return {};
    const groups = getNavigationForRole(profile.role);
    const initial: Record<string, boolean> = {};
    groups.forEach((group) => {
      const hasActiveRoute = group.items.some((item) => item.url === pathname);
      if (hasActiveRoute) {
        initial[group.label] = true;
      }
    });
    return initial;
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  if (!profile) return null;

  const groups = getNavigationForRole(profile.role);
  const initials = (profile.displayName || profile.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups((prev) => {
      const newState: Record<string, boolean> = {};

      // Auto-hide other menus - collapse all other groups
      Object.keys(prev).forEach((key) => {
        newState[key] = false;
      });

      // Toggle the clicked group
      newState[groupLabel] = !prev[groupLabel];

      return newState;
    });
  };

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/login");
  };

  // Auto-scroll to active item when drawer opens or active route changes
  useEffect(() => {
    if (open && activeItemRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        activeItemRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [open, pathname]);

  // Find the active group and ensure it's expanded when route changes
  useEffect(() => {
    if (!profile) return;

    const activeGroup = groups.find((group) => group.items.some((item) => item.url === pathname));

    if (activeGroup && !expandedGroups[activeGroup.label]) {
      setExpandedGroups((prev) => ({
        ...prev,
        [activeGroup.label]: true,
      }));
    }
  }, [pathname, profile]);

  return (
    <>
      {/* Menu Button - Visible on Mobile */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 md:h-[40px] md:w-[40px] h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm border border-white/[0.08] shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-sm p-0 bg-background border-r border-white/[0.08] flex flex-col"
        >
          {/* Close Button */}
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-50 rounded-full p-2 hover:bg-white/[0.04] transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div
            className="p-5 border-b border-white/[0.06] bg-gradient-to-br from-primary/15 via-transparent to-accent/10 flex-shrink-0"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-primary/30">
                <AvatarImage src={profile.avatarUrl} />
                <AvatarFallback className="bg-gradient-to-br from-primary/40 to-accent/40 text-primary-foreground font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold truncate">{profile.displayName || profile.email}</div>
                <div className="text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</div>
              </div>
            </div>

            {activeOrgName && (
              <TouchPress
                onClick={() => go("/select-organization")}
                className="mt-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-foreground/90 w-full justify-center"
              >
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{activeOrgName}</span>
              </TouchPress>
            )}
          </div>

          {/* Navigation Groups with Collapsible Sections - Scrollable */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-2">
            {groups.map((group) => {
              const isExpanded = expandedGroups[group.label] ?? false;
              const hasActiveRoute = group.items.some((item) => item.url === pathname);
              const groupLabel = group.label;

              return (
                <div
                  key={group.label}
                  className="px-3 py-1"
                  ref={(el) => {
                    if (el) groupRefs.current[groupLabel] = el;
                  }}
                >
                  {/* Group Header - Clickable to toggle */}
                  <TouchPress
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-2.5 rounded-lg transition-colors",
                      hasActiveRoute && !isExpanded ? "bg-primary/10 text-primary" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-widest font-semibold",
                        hasActiveRoute && !isExpanded ? "text-primary" : "text-muted-foreground/70",
                      )}
                    >
                      {group.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform duration-200",
                        hasActiveRoute && !isExpanded ? "text-primary" : "text-muted-foreground/70",
                        isExpanded ? "rotate-0" : "-rotate-90",
                      )}
                    />
                  </TouchPress>

                  {/* Group Items - Collapsible */}
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-200 ease-in-out",
                      isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
                    )}
                  >
                    <div className="space-y-0.5 mt-1 ml-1">
                      {group.items.map((item) => {
                        const isActive = pathname === item.url;
                        const Icon = item.icon;

                        return (
                          <TouchPress
                            key={item.url}
                            onClick={() => go(item.url)}
                            ref={isActive ? activeItemRef : undefined}
                            className={cn(
                              "w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm text-left transition-colors",
                              isActive
                                ? "bg-gradient-to-r from-primary/20 to-accent/10 text-primary font-medium"
                                : "text-foreground/85 hover:bg-white/[0.04] active:bg-white/[0.08]",
                            )}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate flex-1">{item.title}</span>
                            {isActive && <div className="w-1 h-5 rounded-full bg-primary" />}
                          </TouchPress>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div
            className="border-t border-white/[0.06] p-3 space-y-1 flex-shrink-0"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <TouchPress
              onClick={() => go("/profile")}
              className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-foreground/85 hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors"
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Profile</span>
            </TouchPress>

            {profile.role === "superadmin" && (
              <TouchPress
                onClick={() => go("/settings")}
                className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-foreground/85 hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors"
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">Settings</span>
              </TouchPress>
            )}

            <TouchPress
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Sign Out</span>
            </TouchPress>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
