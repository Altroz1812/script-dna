import { supabase } from "@/integrations/supabase/client";
import type { AppRole, UserProfile } from "@/types/roles";

export interface TenantOrg {
  id: string;
  name: string;
}

export interface EnhancedUserProfile extends UserProfile {
  availableOrgs?: TenantOrg[];
}

export const userService = {
  async getProfile(userId: string): Promise<EnhancedUserProfile | null> {
    // Query profiles, roles, and all organization memberships simultaneously
    const [profileRes, roleRes, membershipsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase
        .from("organization_members")
        .select(
          `
          organization_id,
          organizations:organization_id (
            id,
            name
          )
        `,
        )
        .eq("user_id", userId),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (!profileRes.data) return null;

    const data = profileRes.data;
    const role = (roleRes.data?.role as AppRole) ?? "student";

    // Parse the organization rows cleanly
    const orgs: TenantOrg[] = [];
    if (membershipsRes.data) {
      membershipsRes.data.forEach((row: any) => {
        if (row.organizations) {
          orgs.push({
            id: row.organizations.id,
            name: row.organizations.name || "Unnamed Organization",
          });
        }
      });
    }

    return {
      id: data.user_id,
      email: data.email ?? "",
      displayName: data.display_name ?? "",
      avatarUrl: data.avatar_url ?? undefined,
      organizationId: data.organization_id ?? undefined, // Maintained for backwards compatibility
      role,
      availableOrgs: orgs, // <-- Injecting the array globally here
    };
  },

  async getUserRole(userId: string): Promise<AppRole> {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();

    if (error) throw error;
    return (data?.role as AppRole) ?? "student";
  },

  async updateProfile(userId: string, updates: Partial<Pick<UserProfile, "displayName" | "avatarUrl">>) {
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: updates.displayName,
        avatar_url: updates.avatarUrl,
      })
      .eq("user_id", userId);

    if (error) throw error;
  },
};
