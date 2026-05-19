// Single secure gateway for all admin/tenant-sensitive data.
// EVERY action is forwarded to the `admin-query` edge function.
// The edge function (service role) is the *only* place tenant filtering and
// authorization decisions are made. Never call supabase.from(...) for admin
// data here — that bypasses the org scope and leaks cross-tenant data.

import { supabase } from "@/integrations/supabase/client";
import { readActiveOrgFromStorage } from "@/contexts/ActiveOrgContext";

const PUBLIC_GLOBAL_ACTIONS = new Set<string>([
  // SuperAdmin-only org management — never tenant-scoped
  "list_organizations",
  "create_organization",
  "delete_organization",
  "toggle_org_active",
  "list_org_members",
  "add_org_member",
  "remove_org_member",
  "set_user_organizations",
  // Parent/child mapping is global
  "list_parent_children",
  "add_parent_child",
  "remove_parent_child",
  "list_parents",
  // Unauth helpers
  "check_email_exists",
  // Subscription plans catalog
  "list_subscription_plans",
  "create_subscription_plan",
  "update_subscription_plan",
  "delete_subscription_plan",
  // Branding edits target a specific org_id explicitly in params
  "update_org_branding",
]);

export async function adminQuery(action: string, params: any = {}): Promise<any> {
  params = params ?? {};

  // Auto-inject target_org_id for tenant-scoped actions unless caller
  // explicitly opts out (e.g., SuperAdmin global view passes null).
  if (
    !PUBLIC_GLOBAL_ACTIONS.has(action) &&
    !params.__skip_org_filter &&
    params.target_org_id === undefined
  ) {
    const active = readActiveOrgFromStorage();
    // string => scoped, null => SuperAdmin global view (pass through),
    // undefined => no selection yet (let edge function 403 non-SA).
    if (typeof active === "string") {
      params = { ...params, target_org_id: active };
    } else if (active === null) {
      params = { ...params, target_org_id: null };
    }
  }
  if (params && "__skip_org_filter" in params) {
    const { __skip_org_filter: _omit, ...rest } = params;
    params = rest;
  }

  const { data, error } = await supabase.functions.invoke("admin-query", {
    body: { action, params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Back-compat helpers used in a few places (e.g. Dashboard get_stats with
// different param shape). Keep a thin wrapper so call sites don't break.
export async function getStats(opts: { organizationId?: string | null; isSuperadmin?: boolean } = {}) {
  return adminQuery("get_stats", {
    target_org_id: opts.organizationId ?? null,
  });
}
