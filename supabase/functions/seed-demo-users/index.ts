import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_ORGS = [
  {
    name: "Sunrise Academy",
    slug: "sunrise-academy",
  },
  {
    name: "Bright Future Institute",
    slug: "bright-future",
  },
];

const DEMO_USERS = [
  // platform superadmin
  {
    email: "superadmin@demo.com",
    password: "Demo1234!",
    role: "superadmin",
    name: "Super Admin",
    org: null,
  },

  // Sunrise Academy
  {
    email: "admin@demo.com",
    password: "Demo1234!",
    role: "admin",
    name: "Admin User",
    org: "sunrise-academy",
  },
  {
    email: "teacher@demo.com",
    password: "Demo1234!",
    role: "teacher",
    name: "Teacher User",
    org: "sunrise-academy",
  },
  {
    email: "student@demo.com",
    password: "Demo1234!",
    role: "student",
    name: "Student User",
    org: "sunrise-academy",
  },
  {
    email: "parent@demo.com",
    password: "Demo1234!",
    role: "parent",
    name: "Parent User",
    org: "sunrise-academy",
  },

  // Bright Future Institute
  {
    email: "support@demo.com",
    password: "Demo1234!",
    role: "support",
    name: "Support User",
    org: "bright-future",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const results: any[] = [];

    // ------------------------------------------------
    // CREATE / GET ORGANIZATIONS
    // ------------------------------------------------

    const orgIdMap: Record<string, string> = {};

    for (const org of DEMO_ORGS) {
      const { data: existingOrg, error: existingOrgError } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("slug", org.slug)
        .maybeSingle();

      if (existingOrgError) {
        results.push({
          organization: org.name,
          status: "error",
          error: existingOrgError.message,
        });

        continue;
      }

      if (existingOrg) {
        orgIdMap[org.slug] = existingOrg.id;

        results.push({
          organization: org.name,
          status: "already_exists",
        });

        continue;
      }

      const { data: createdOrg, error: createOrgError } = await supabaseAdmin
        .from("organizations")
        .insert({
          name: org.name,
          slug: org.slug,
        })
        .select("id")
        .single();

      if (createOrgError || !createdOrg) {
        results.push({
          organization: org.name,
          status: "error",
          error: createOrgError?.message,
        });

        continue;
      }

      orgIdMap[org.slug] = createdOrg.id;

      results.push({
        organization: org.name,
        status: "created",
      });
    }

    // ------------------------------------------------
    // CREATE USERS
    // ------------------------------------------------

    for (const user of DEMO_USERS) {
      let userId: string | null = null;

      // -----------------------------
      // CREATE AUTH USER
      // -----------------------------

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          display_name: user.name,
        },
      });

      // -----------------------------
      // USER ALREADY EXISTS
      // -----------------------------

      if (authError) {
        if (authError.message?.includes("already been registered")) {
          const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

          if (usersError) {
            results.push({
              email: user.email,
              status: "error",
              error: usersError.message,
            });

            continue;
          }

          const existingUser = usersData?.users?.find((u: any) => u.email === user.email);

          if (!existingUser) {
            results.push({
              email: user.email,
              status: "error",
              error: "Existing user not found",
            });

            continue;
          }

          userId = existingUser.id;

          results.push({
            email: user.email,
            status: "already_exists",
          });
        } else {
          results.push({
            email: user.email,
            status: "error",
            error: authError.message,
          });

          continue;
        }
      } else {
        userId = authData.user.id;

        results.push({
          email: user.email,
          status: "created",
        });
      }

      if (!userId) {
        continue;
      }

      // ------------------------------------------------
      // ROLE UPSERT
      // ------------------------------------------------

      const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
        {
          user_id: userId,
          role: user.role,
        },
        {
          onConflict: "user_id",
        },
      );

      if (roleError) {
        results.push({
          email: user.email,
          status: "role_error",
          error: roleError.message,
        });
      } else {
        results.push({
          email: user.email,
          role: user.role,
          status: "role_assigned",
        });
      }

      // ------------------------------------------------
      // ORG ASSIGNMENT
      // ------------------------------------------------

      let organizationId: string | null = null;

      if (user.org && orgIdMap[user.org]) {
        organizationId = orgIdMap[user.org];

        // -----------------------------
        // organization_members upsert
        // -----------------------------

        const { error: memberError } = await supabaseAdmin.from("organization_members").upsert(
          {
            user_id: userId,
            organization_id: organizationId,
          },
          {
            onConflict: "user_id,organization_id",
          },
        );

        if (memberError) {
          results.push({
            email: user.email,
            status: "membership_error",
            error: memberError.message,
          });
        } else {
          results.push({
            email: user.email,
            organization: user.org,
            status: "membership_added",
          });
        }
      }

      // ------------------------------------------------
      // PROFILE UPSERT
      // ------------------------------------------------

      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
        {
          user_id: userId,
          email: user.email,
          display_name: user.name,
          organization_id: organizationId,
        },
        {
          onConflict: "user_id",
        },
      );

      if (profileError) {
        results.push({
          email: user.email,
          status: "profile_error",
          error: profileError.message,
        });
      } else {
        results.push({
          email: user.email,
          organization_id: organizationId,
          status: "profile_updated",
        });
      }
    }

    // ------------------------------------------------
    // SUCCESS RESPONSE
    // ------------------------------------------------

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: any) {
    console.error("EDGE FUNCTION ERROR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
