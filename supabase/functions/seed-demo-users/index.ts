import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEMO_ORGS = [
  { name: "Sunrise Academy", slug: "sunrise-academy" },
  { name: "Bright Future Institute", slug: "bright-future" },
];

const DEMO_USERS = [
  // Superadmin – no org (platform-level)
  { email: "superadmin@demo.com", password: "Demo1234!", role: "superadmin", name: "Super Admin", org: null },
  // Sunrise Academy staff & students
  { email: "admin@demo.com", password: "Demo1234!", role: "admin", name: "Admin User", org: "sunrise-academy" },
  { email: "teacher@demo.com", password: "Demo1234!", role: "teacher", name: "Teacher User", org: "sunrise-academy" },
  { email: "student@demo.com", password: "Demo1234!", role: "student", name: "Student User", org: "sunrise-academy" },
  { email: "parent@demo.com", password: "Demo1234!", role: "parent", name: "Parent User", org: "sunrise-academy" },
  // Bright Future Institute
  { email: "support@demo.com", password: "Demo1234!", role: "support", name: "Support User", org: "bright-future" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // 2. Create users, assign roles & org memberships
    for (const user of DEMO_USERS) {
      let userId: string | null = null;

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: { display_name: user.name },
        });

      if (authError) {
        if (authError.message?.includes("already been registered")) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existing = listData?.users?.find((u: any) => u.email === user.email);
          if (existing) {
            userId = existing.id;
            await supabaseAdmin
              .from("user_roles")
              .update({ role: user.role })
              .eq("user_id", userId);
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
        if (user.role !== "student") {
          await supabaseAdmin
            .from("user_roles")
            .update({ role: user.role })
            .eq("user_id", userId);
        }
        results.push({ email: user.email, status: "created", role: user.role });
      }

      // Assign org membership + update profile.organization_id
      if (userId && user.org && orgIdMap[user.org]) {
        const orgId = orgIdMap[user.org];

        // Upsert org membership
        const { data: memberExists } = await supabaseAdmin
          .from("organization_members")
          .select("id")
          .eq("user_id", userId)
          .eq("organization_id", orgId)
          .maybeSingle();

        if (!memberExists) {
          await supabaseAdmin
            .from("organization_members")
            .insert({ user_id: userId, organization_id: orgId });
        }

        // Update profile with org
        await supabaseAdmin
          .from("profiles")
          .update({ organization_id: orgId })
          .eq("user_id", userId);

        results.push({ email: user.email, org: user.org, status: "org_assigned" });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
