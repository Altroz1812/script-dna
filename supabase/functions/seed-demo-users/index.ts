import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_ORGS = [
  { name: "Sunrise Academy", slug: "sunrise-academy" },
  { name: "Bright Future Institute", slug: "bright-future" },
  { name: "Venture Bridge Partners", slug: "venture-bridge" },
];

const DEMO_USERS = [
  // Superadmin – platform-level clearance
  { email: "superadmin@demo.com", password: "Demo1234!", role: "superadmin", name: "Super Admin", orgs: [] },

  // Single Tenant Users
  {
    email: "teacher@demo.com",
    password: "Demo1234!",
    role: "teacher",
    name: "Teacher User",
    orgs: ["sunrise-academy"],
  },
  {
    email: "student@demo.com",
    password: "Demo1234!",
    role: "student",
    name: "Student User",
    orgs: ["sunrise-academy"],
  },

  // Multi-Tenant User (Belongs to BOTH Sunrise Academy and Venture Bridge)
  // Logging in with this user will force your Sidebar Switcher Dropdown to render!
  {
    email: "admin@demo.com",
    password: "Demo1234!",
    role: "admin",
    name: "Cross-Tenant Manager",
    orgs: ["sunrise-academy", "venture-bridge"],
  },
  { email: "support@demo.com", password: "Demo1234!", role: "support", name: "Support User", orgs: ["bright-future"] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const results: any[] = [];

    // 1. Upsert demo organizations
    const orgIdMap: Record<string, string> = {};
    for (const org of DEMO_ORGS) {
      const { data: existing } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", org.slug)
        .maybeSingle();

      if (existing) {
        orgIdMap[org.slug] = existing.id;
        results.push({ org: org.name, status: "exists" });
      } else {
        const { data: created, error } = await supabaseAdmin
          .from("organizations")
          .insert({ name: org.name, slug: org.slug })
          .select("id")
          .single();
        if (error) {
          results.push({ org: org.name, status: "error", error: error.message });
          continue;
        }
        orgIdMap[org.slug] = created.id;
        results.push({ org: org.name, status: "created" });
      }
    }

    // 2. Process multi-tenant user objects
    for (const user of DEMO_USERS) {
      let userId: string | null = null;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { display_name: user.name },
      });

      if (authError) {
        if (authError.message?.includes("already been registered")) {
          // User exists, retrieve their UID
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existing = listData?.users?.find((u: any) => u.email === user.email);
          if (existing) {
            userId = existing.id;

            // FIX: Use an upsert strategy for role assignments to avoid missing-row silent failures
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: userId, role: user.role }, { onConflict: "user_id" });

            results.push({ email: user.email, status: "exists, role updated" });
          } else {
            results.push({ email: user.email, status: "error", error: authError.message });
            continue;
          }
        } else {
          results.push({ email: user.email, status: "error", error: authError.message });
          continue;
        }
      } else {
        userId = authData.user.id;

        // FIX: Change .update() to .upsert() for new users to successfully insert the row
        await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: user.role }, { onConflict: "user_id" });

        results.push({ email: user.email, status: "created", role: user.role });
      }

      // 3. Process multiple organizational mapping relationships
      if (userId && user.orgs && user.orgs.length > 0) {
        let primaryOrgSet = false;

        for (const orgSlug of user.orgs) {
          const orgId = orgIdMap[orgSlug];
          if (!orgId) continue;

          // Check junction record
          const { data: memberExists } = await supabaseAdmin
            .from("organization_members")
            .select("id")
            .eq("user_id", userId)
            .eq("organization_id", orgId)
            .maybeSingle();

          if (!memberExists) {
            await supabaseAdmin.from("organization_members").insert({ user_id: userId, organization_id: orgId });
          }

          // Set the first organization processed as the default fallback target inside public.profiles
          if (!primaryOrgSet) {
            await supabaseAdmin.from("profiles").update({ organization_id: orgId }).eq("user_id", userId);
            primaryOrgSet = true;
          }
        }
        results.push({ email: user.email, orgs: user.orgs, status: "all_workspace_memberships_mapped" });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
