import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Reused service-role client (auth + role lookup) across warm invocations.
const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Small in-memory rate limiter (per-user) to absorb reconnect storms.
const rateBucket = new Map<string, number[]>();
function rateLimited(userId: string, max = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (rateBucket.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { rateBucket.set(userId, arr); return true; }
  arr.push(now); rateBucket.set(userId, arr); return false;
}

// Minimal LiveKit JWT generation without external SDK
// LiveKit tokens are standard JWTs with specific claims

type RoleBucket = "moderator" | "viewer";

async function createLivekitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  roomName: string,
  roleBucket: RoleBucket,
  appRole: string,
  displayName: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };

  const now = Math.floor(Date.now() / 1000);
  const isModerator = roleBucket === "moderator";
  const metadata = JSON.stringify({ role: appRole, bucket: roleBucket });
  const payload: Record<string, unknown> = {
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: now + 3600, // 1 hour
    jti: crypto.randomUUID(),
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: isModerator,
      canSubscribe: true,
      // Viewers can send data so they can post chat too; flip to false to make chat read-only
      canPublishData: true,
      canPublishSources: isModerator
        ? ["camera", "microphone", "screen_share", "screen_share_audio"]
        : [],
      ...(isModerator ? { roomAdmin: true } : {}),
    },
    name: displayName || identity,
    metadata,
  };

  const enc = new TextEncoder();
  const b64url = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));

  return `${data}.${b64url(sig)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rateLimited(user.id)) {
      return new Response(JSON.stringify({ error: "Too many token requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { roomName, participantName } = await req.json();

    if (!roomName || !participantName) {
      return new Response(
        JSON.stringify({ error: "roomName and participantName are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const rawUrl = Deno.env.get("LIVEKIT_URL");
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!rawUrl || !apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: "LiveKit not configured. Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize: strip whitespace/quotes, rewrite https→wss, drop trailing slash
    let livekitUrl = rawUrl.trim().replace(/^["']|["']$/g, "");
    if (livekitUrl.startsWith("https://")) livekitUrl = "wss://" + livekitUrl.slice(8);
    else if (livekitUrl.startsWith("http://")) livekitUrl = "ws://" + livekitUrl.slice(7);
    livekitUrl = livekitUrl.replace(/\/+$/, "");

    if (!livekitUrl.startsWith("wss://")) {
      const prefix = livekitUrl.slice(0, 12);
      return new Response(
        JSON.stringify({ error: `LiveKit server URL is invalid. It must start with wss:// (got "${prefix}...")` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Derive role server-side (do NOT trust client).
    // A user may have multiple rows in user_roles; pick the highest-priority role.
    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles: string[] = Array.isArray(roleRows)
      ? roleRows.map((r: any) => r.role).filter(Boolean)
      : [];
    const priority = ["superadmin", "admin", "support", "teacher", "student", "parent"];
    const appRole: string =
      priority.find((r) => roles.includes(r)) ?? "student";
    const moderatorRoles = ["superadmin", "admin", "support", "teacher"];
    const roleBucket: RoleBucket = moderatorRoles.includes(appRole)
      ? "moderator"
      : "viewer";

    const token = await createLivekitToken(
      apiKey,
      apiSecret,
      user.id,
      roomName,
      roleBucket,
      appRole,
      participantName
    );

    return new Response(
      JSON.stringify({ token, url: livekitUrl, role: appRole, bucket: roleBucket }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
