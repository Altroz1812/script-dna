import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client to get the authenticated user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client to bypass RLS for reading profile + roles + dashboard stats
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Parallel queries for maximum speed
    const [profileResult, roleResult, statsResult] = await Promise.all([
      // 1. Profile
      adminClient
        .from("profiles")
        .select("user_id, email, display_name, avatar_url, organization_id")
        .eq("user_id", user.id)
        .maybeSingle(),

      // 2. Role
      adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle(),

      // 3. Dashboard context — counts relevant to the user's role
      (async () => {
        const counts: Record<string, number> = {};

        // Get role first for conditional queries
        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const role = roleData?.role ?? "student";

        if (["superadmin", "admin", "support"].includes(role)) {
          const [courses, batches, orgs] = await Promise.all([
            adminClient.from("courses").select("id", { count: "exact", head: true }),
            adminClient.from("batches").select("id", { count: "exact", head: true }),
            adminClient.from("organizations").select("id", { count: "exact", head: true }),
          ]);
          counts.total_courses = courses.count ?? 0;
          counts.total_batches = batches.count ?? 0;
          counts.total_organizations = orgs.count ?? 0;
        }

        if (["teacher"].includes(role)) {
          const { count } = await adminClient
            .from("batches")
            .select("id", { count: "exact", head: true })
            .eq("teacher_id", user.id);
          counts.my_batches = count ?? 0;
        }

        if (["student"].includes(role)) {
          const { count } = await adminClient
            .from("batch_students")
            .select("id", { count: "exact", head: true })
            .eq("student_id", user.id);
          counts.my_enrollments = count ?? 0;
        }

        return { role, counts };
      })(),
    ]);

    if (profileResult.error) {
      console.error("Profile query error:", profileResult.error);
    }

    const profile = profileResult.data;
    const role = roleResult.data?.role ?? "student";
    const dashboardStats = statsResult.counts;

    const response = {
      profile: {
        id: user.id,
        email: profile?.email ?? user.email ?? "",
        displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "",
        avatarUrl: profile?.avatar_url ?? null,
        organizationId: profile?.organization_id ?? null,
        role,
      },
      dashboard: {
        stats: dashboardStats,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fast-login-profile error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
