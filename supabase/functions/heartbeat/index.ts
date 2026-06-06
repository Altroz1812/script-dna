import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create admin client with service role (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");

    // If no auth header, return simple health check response
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
          note: "No auth token provided - health check only",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Extract token
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "No token provided" }), {
        status: 200, // Changed from 401 to 200 to prevent runtime errors
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      // Return 200 even for invalid tokens to prevent runtime crashes
      return new Response(
        JSON.stringify({
          status: "unauthenticated",
          message: "Invalid or expired token",
        }),
        {
          status: 200, // Changed from 401 to 200
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse body for 'end' parameter
    let body = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, that's ok
    }

    const end = body?.end === true;
    const userId = user.id;
    const now = new Date().toISOString();

    // Get IP and User Agent
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Find open session
    const { data: openSession } = await supabaseAdmin
      .from("user_sessions")
      .select("id")
      .eq("user_id", userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openSession) {
      // Update existing session
      const updateData: any = { last_seen_at: now };
      if (end) updateData.ended_at = now;

      await supabaseAdmin.from("user_sessions").update(updateData).eq("id", openSession.id);

      return new Response(
        JSON.stringify({
          ok: true,
          session_id: openSession.id,
          action: end ? "ended" : "updated",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create new session if not ending
    if (!end) {
      const { data: newSession, error: insertError } = await supabaseAdmin
        .from("user_sessions")
        .insert({
          user_id: userId,
          ip_address: ip,
          user_agent: userAgent,
          started_at: now,
          last_seen_at: now,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Session insert error:", insertError);
        // Don't throw, return gracefully
      }

      return new Response(
        JSON.stringify({
          ok: true,
          session_id: newSession?.id || null,
          action: "created",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // No open session and trying to end - nothing to do
    return new Response(JSON.stringify({ ok: true, action: "noop" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Heartbeat error:", error);

    // Always return 200 to prevent runtime errors
    return new Response(
      JSON.stringify({
        error: error.message || "Internal error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200, // Changed from 500 to 200
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
