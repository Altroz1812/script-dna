import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { encode as hexEncode } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cashfree-timestamp, x-cashfree-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  try {
    const payload = timestamp + rawBody;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secretKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const computed = new TextDecoder().decode(hexEncode(new Uint8Array(sig)));
    return computed === signature;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Get Cashfree config for signature verification
    const { data: config } = await supabaseAdmin
      .from("payment_config")
      .select("secret_key")
      .eq("provider", "cashfree")
      .eq("is_active", true)
      .single();

    if (config?.secret_key) {
      const timestamp = req.headers.get("x-cashfree-timestamp") || "";
      const signature = req.headers.get("x-cashfree-signature") || "";

      if (timestamp && signature) {
        const valid = await verifySignature(rawBody, timestamp, signature, config.secret_key);
        if (!valid) return jsonRes({ error: "Invalid signature" }, 401);
      }
    }

    const { data: eventData, type: eventType } = body;
    if (!eventData?.order?.order_id) {
      return jsonRes({ error: "Missing order_id in webhook payload" }, 400);
    }

    const cfOrderId = eventData.order.order_id;
    const paymentStatus = eventData.payment?.payment_status;

    // Find the order by cashfree_order_id
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("cashfree_order_id", cfOrderId)
      .single();

    if (!order) return jsonRes({ error: "Order not found" }, 404);

    // Map Cashfree status to our status
    let newStatus = "pending";
    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus === "SUCCESS") {
      newStatus = "paid";
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK" || paymentStatus === "FAILED") {
      newStatus = "failed";
    } else if (paymentStatus === "USER_DROPPED") {
      newStatus = "failed";
    }

    // Update order status
    await supabaseAdmin
      .from("orders")
      .update({ status: newStatus })
      .eq("id", order.id);

    // On success: create payment records and a lead
    if (newStatus === "paid") {
      // Create payment record
      await supabaseAdmin.from("payments").insert({
        student_id: order.user_id,
        amount: order.final_amount,
        currency: "INR",
        description: `Order ${cfOrderId}`,
        status: "completed",
      });

      // Materialise the checkout lead now that payment is confirmed.
      // Organisation is intentionally left NULL — SuperAdmin assigns it on approval.
      const payload: any = order.lead_payload ?? null;
      if (payload) {
        // Avoid duplicate lead inserts on retried webhooks.
        const { data: existing } = await supabaseAdmin
          .from("leads").select("id").eq("order_id", order.id).maybeSingle();
        if (!existing) {
          const studentsFlat: any[] = Array.isArray(payload.students) ? payload.students : [];
          const itemsArr: any[] = Array.isArray(payload.items) ? payload.items : [];
          await supabaseAdmin.from("leads").insert({
            name: payload.parent_name || payload.parent_email || "Checkout enrollment",
            email: payload.parent_email || null,
            phone: null,
            source: "checkout",
            status: "new",
            organization_id: null, // SuperAdmin assigns on approval
            order_id: order.id,
            notes: `Paid ₹${order.final_amount} • ${itemsArr.length} course(s) • ${studentsFlat.length} student(s) • Order ${cfOrderId}`,
            metadata: { ...payload, paid_at: new Date().toISOString(), cashfree_order_id: cfOrderId },
          });
        }
      }
    }

    return jsonRes({ success: true, status: newStatus });
  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
