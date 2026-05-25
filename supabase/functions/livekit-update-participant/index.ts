import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Build a short-lived admin JWT for LiveKit server REST API
async function createAdminToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: apiKey,
    iat: now,
    nbf: now,
    exp: now + 300,
    jti: crypto.randomUUID(),
    video: { roomAdmin: true, room: roomName },
  };
  const enc = new TextEncoder();
  const b64url = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const h = b64url(enc.encode(JSON.stringify(header)));
  const p = b64url(enc.encode(JSON.stringify(payload)));
  const data = `${h}.${p}`;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

function toHttp(url: string): string {
  let u = url.trim().replace(/^["']|["']$/g, "");
  if (u.startsWith("wss://")) u = "https://" + u.slice(6);
  else if (u.startsWith("ws://")) u = "http://" + u.slice(5);
  return u.replace(/\/+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller must be a moderator
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const role: string = (roleRow?.role as string) ?? "student";
    const moderatorRoles = ["superadmin", "admin", "support", "teacher"];
    if (!moderatorRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      roomName, identity,
      canPublish, canPublishSources, canPublishData, canSubscribe,
    } = await req.json();
    if (!roomName || !identity) {
      return new Response(JSON.stringify({ error: "roomName and identity required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawUrl = Deno.env.get("LIVEKIT_URL");
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    if (!rawUrl || !apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const host = toHttp(rawUrl);
    const adminToken = await createAdminToken(apiKey, apiSecret, roomName);

    const body = {
      room: roomName,
      identity,
      permission: {
        can_subscribe: canSubscribe ?? true,
        can_publish: !!canPublish,
        can_publish_data: canPublishData ?? true,
        can_publish_sources: canPublishSources ?? [],
      },
    };

    const resp = await fetch(`${host}/twirp/livekit.RoomService/UpdateParticipant`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `LiveKit error: ${text}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(text || JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});