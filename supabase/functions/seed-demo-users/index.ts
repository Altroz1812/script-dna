import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1. Map organizations directly corresponding to your frontend buttons
const DEMO_ORGS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sunrise Academy", slug: "sunrise-academy" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Bright Future", slug: "bright-future" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Venture Bridge Partners", slug: "venture-bridge" },
];

// 2. Synchronize exact accounts from the frontend Login component DEMO_ACCOUNTS array
const DEMO_USERS = [
  {
    id: "a1111111-aaaa-bbbb-cccc-000000000001",
    email: "superadmin@demo.com",
    password: "Demo1234!",
    role: "superadmin",
    name: "Super Admin",
    orgs: [], // Platform wide context
  },
  {
    id: "a2222222-aaaa-bbbb-cccc-000000000002",
    email: "admin@demo.com",
    password: "Demo1234!",
    role: "admin",
    name: "Admin",
    // Multi-tenant configuration: We assign them to both organizations so they can test switching!
    orgs: ["sunrise-academy", "venture-bridge"],
  },
  {
    id: "a3333333-aaaa-bbbb-cccc-000000000003",
    email: "teacher@demo.com",
    password: "Demo1234!",
    role: "teacher",
    name: "Teacher",
    orgs: ["sunrise-academy"],
  },
  {
    id: "a4444444-aaaa-bbbb-cccc-000000000004",
    email: "student@demo.com",
    password: "Demo1234!",
    role: "student",
    name: "Student",
    orgs: ["sunrise-academy"],
  },
  {
    id: "a5555555-aaaa-bbbb-cccc-000000000005",
    email: "support@demo.com",
    password: "Demo1234!",
    role: "support",
    name: "Support",
    orgs: ["bright-future"],
  },
  {
    id: "a6666666-aaaa-bbbb-cccc-000000000006",
    email: "parent@demo.com",
    password: "Demo1234!",
    role: "parent",
    name: "Parent",
    orgs: ["sunrise-academy"],
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const results: any[] = [];
    const orgIdMap: Record<string, string> = {};

    // STEP 1: Provision and map organization instances
    for (const org of DEMO_ORGS) {
      const { data: existingOrg } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", org.slug)
        .maybeSingle();

      if (existingOrg) {
        orgIdMap[org.slug] = existingOrg.id;
        results.push({ entity: "organization", name: org.name, status: "exists" });
      } else {
        const { data: createdOrg, error: orgError } = await supabaseAdmin
          .from("organizations")
          .insert({ id: org.id, name: org.name, slug: org.slug })
          .select("id")
          .single();

        if (orgError) {
          results.push({ entity: "organization", name: org.name, status: "error", error: orgError.message });
          continue;
        }
        orgIdMap[org.slug] = createdOrg.id;
        results.push({ entity: "organization", name: org.name, status: "created" });
      }
    }

    // STEP 2: Seed corresponding user records safely
    for (const user of DEMO_USERS) {
      let finalUserId = user.id;
      let userExistsOrCreated = false;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { display_name: user.name },
      });

      if (authError) {
        if (
          authError.message?.includes("already been registered") ||
          authError.message?.includes("User already exists")
        ) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = listData?.users?.find((u: any) => u.email === user.email);
          if (existingUser) {
            finalUserId = existingUser.id;
            userExistsOrCreated = true;
            results.push({ entity: "auth_user", email: user.email, status: "exists" });
          } else {
            results.push({ entity: "auth_user", email: user.email, status: "error", error: authError.message });
            continue;
          }
        } else {
          results.push({ entity: "auth_user", email: user.email, status: "error", error: authError.message });
          continue;
        }
      } else {
        finalUserId = authData.user.id;
        userExistsOrCreated = true;
        results.push({ entity: "auth_user", email: user.email, status: "created" });
      }

      // STEP 3: Connect application roles and multi-tenant profiles
      if (userExistsOrCreated && finalUserId) {
        // A. Assign application security role clearance using an upsert strategy
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: finalUserId, role: user.role }, { onConflict: "user_id" });

        // B. Populate organization multi-tenant mappings
        if (user.orgs && user.orgs.length > 0) {
          let fallbackPrimaryOrgId: string | null = null;

          for (const slug of user.orgs) {
            const targetedOrgId = orgIdMap[slug];
            if (!targetedOrgId) continue;

            if (!fallbackPrimaryOrgId) {
              fallbackPrimaryOrgId = targetedOrgId; // Assign the first organization as the default profile fallback
            }

            // Verify mapping record existence inside organization_members table
            const { data: linkExists } = await supabaseAdmin
              .from("organization_members")
              .select("id")
              .eq("user_id", finalUserId)
              .eq("organization_id", targetedOrgId)
              .maybeSingle();

            if (!linkExists) {
              await supabaseAdmin
                .from("organization_members")
                .insert({ user_id: finalUserId, organization_id: targetedOrgId });
            }
          }

          // C. Upsert rows into public.profiles to establish structural baseline states
          if (fallbackPrimaryOrgId) {
            await supabaseAdmin.from("profiles").upsert(
              {
                user_id: finalUserId,
                email: user.email,
                display_name: user.name,
                organization_id: fallbackPrimaryOrgId,
              },
              { onConflict: "user_id" },
            );
          }

          results.push({ entity: "memberships", email: user.email, status: "synchronized", orgs: user.orgs });
        } else {
          // Account doesn't belong to any organization (e.g. platform-level superadmin)
          await supabaseAdmin.from("profiles").upsert(
            {
              user_id: finalUserId,
              email: user.email,
              display_name: user.name,
              organization_id: null,
            },
            { onConflict: "user_id" },
          );

          results.push({ entity: "memberships", email: user.email, status: "synchronized", orgs: [] });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
