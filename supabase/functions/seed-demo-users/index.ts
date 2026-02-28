import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEMO_USERS = [
  { email: "superadmin@demo.com", password: "Demo1234!", role: "superadmin", name: "Super Admin" },
  { email: "admin@demo.com", password: "Demo1234!", role: "admin", name: "Admin User" },
  { email: "support@demo.com", password: "Demo1234!", role: "support", name: "Support User" },
  { email: "teacher@demo.com", password: "Demo1234!", role: "teacher", name: "Teacher User" },
  { email: "student@demo.com", password: "Demo1234!", role: "student", name: "Student User" },
  { email: "parent@demo.com", password: "Demo1234!", role: "parent", name: "Parent User" },
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

    const results = [];

    for (const user of DEMO_USERS) {
      // Create auth user (auto-confirms via admin API)
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: { display_name: user.name },
        });

      if (authError) {
        // User might already exist
        if (authError.message?.includes("already been registered")) {
          // Get existing user
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existing = listData?.users?.find((u: any) => u.email === user.email);
          if (existing) {
            // Update role
            await supabaseAdmin
              .from("user_roles")
              .update({ role: user.role })
              .eq("user_id", existing.id);
            results.push({ email: user.email, status: "exists, role updated" });
          } else {
            results.push({ email: user.email, status: "error", error: authError.message });
          }
          continue;
        }
        results.push({ email: user.email, status: "error", error: authError.message });
        continue;
      }

      const userId = authData.user.id;

      // Update role (trigger creates default 'student', we update to correct role)
      if (user.role !== "student") {
        await supabaseAdmin
          .from("user_roles")
          .update({ role: user.role })
          .eq("user_id", userId);
      }

      results.push({ email: user.email, status: "created", role: user.role });
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
