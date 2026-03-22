import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // Health check — returns whether Cashfree is configured
    if (action === "health") {
      const { data } = await supabaseAdmin
        .from("payment_config")
        .select("app_id, mode, is_active")
        .eq("provider", "cashfree")
        .single();

      const configured = !!(data?.app_id && data.app_id.length > 0 && data.is_active);
      return new Response(
        JSON.stringify({ configured, mode: data?.mode ?? "sandbox" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save config — admin only
    if (action === "save_config") {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
        error: userError,
      } = await supabaseAdmin.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check admin role
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "superadmin"]);

      if (!roleData || roleData.length === 0) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { app_id, secret_key, mode } = body;

      if (!app_id || !secret_key) {
        return new Response(
          JSON.stringify({ error: "App ID and Secret Key are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: upsertError } = await supabaseAdmin
        .from("payment_config")
        .upsert(
          {
            provider: "cashfree",
            app_id,
            secret_key,
            mode: mode || "sandbox",
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "provider" }
        );

      if (upsertError) {
        return new Response(
          JSON.stringify({ error: upsertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
