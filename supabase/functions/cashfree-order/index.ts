import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    const body = await req.json();
    const { action } = body;

    // ── Health check ──
    if (action === "health") {
      const { data } = await supabaseAdmin
        .from("payment_config")
        .select("app_id, mode, is_active")
        .eq("provider", "cashfree")
        .single();

      const configured = !!(data?.app_id && data.app_id.length > 0 && data.is_active);
      return jsonRes({ configured, mode: data?.mode ?? "sandbox" });
    }

    // ── Save config (admin only) ──
    if (action === "save_config") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "superadmin"]);

      if (!roleData || roleData.length === 0) return jsonRes({ error: "Forbidden" }, 403);

      const { app_id, secret_key, mode } = body;
      if (!app_id || !secret_key) return jsonRes({ error: "App ID and Secret Key are required" }, 400);

      const { error: upsertError } = await supabaseAdmin
        .from("payment_config")
        .upsert(
          { provider: "cashfree", app_id, secret_key, mode: mode || "sandbox", is_active: true, updated_at: new Date().toISOString() },
          { onConflict: "provider" }
        );

      if (upsertError) return jsonRes({ error: upsertError.message }, 500);
      return jsonRes({ success: true });
    }

    // ── Create order ──
    if (action === "create_order") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

      const { items, student_details, coupon_code } = body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return jsonRes({ error: "No items provided" }, 400);
      }

      // Calculate discount server-side
      const subtotal = items.reduce((s: number, i: any) => s + (i.fee || 0), 0);
      let courseDiscount = 0;
      if (items.length >= 3) courseDiscount = subtotal * 0.10;
      else if (items.length === 2) courseDiscount = subtotal * 0.05;

      let studentDiscount = 0;
      for (const item of items) {
        const students = student_details?.[item.id] || [];
        const count = students.length;
        if (count >= 3) studentDiscount += (item.fee || 0) * 0.10;
        else if (count === 2) studentDiscount += (item.fee || 0) * 0.05;
      }

      let couponDiscount = 0;
      if (coupon_code) {
        const { data: coupon } = await supabaseAdmin
          .from("coupons")
          .select("*")
          .eq("code", coupon_code)
          .eq("is_active", true)
          .single();

        if (coupon) {
          const afterDisc = subtotal - courseDiscount - studentDiscount;
          if (coupon.discount_type === "percentage") {
            couponDiscount = afterDisc * (Number(coupon.discount_value) / 100);
          } else {
            couponDiscount = Number(coupon.discount_value);
          }
          couponDiscount = Math.min(couponDiscount, afterDisc);
        }
      }

      const totalDiscount = courseDiscount + studentDiscount + couponDiscount;
      const finalAmount = Math.max(0, subtotal - totalDiscount);

      // Get user profile for Cashfree
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, display_name")
        .eq("user_id", user.id)
        .single();

      // Create order in DB
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          user_id: user.id,
          total_amount: subtotal,
          discount_amount: totalDiscount,
          final_amount: finalAmount,
          student_details: student_details || {},
          coupon_code: coupon_code || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (orderError) return jsonRes({ error: orderError.message }, 500);

      // Check if Cashfree is configured
      const { data: config } = await supabaseAdmin
        .from("payment_config")
        .select("*")
        .eq("provider", "cashfree")
        .eq("is_active", true)
        .single();

      if (!config || !config.app_id || !config.secret_key) {
        // Not configured — return order as pending (no payment gateway)
        return jsonRes({ order_id: order.id, configured: false });
      }

      // Call Cashfree Create Order API
      const cfBase = config.mode === "production"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg";

      const cfOrderId = `order_${order.id.replace(/-/g, "").slice(0, 20)}`;

      const cfRes = await fetch(`${cfBase}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2023-08-01",
          "x-client-id": config.app_id,
          "x-client-secret": config.secret_key,
        },
        body: JSON.stringify({
          order_id: cfOrderId,
          order_amount: finalAmount,
          order_currency: "INR",
          customer_details: {
            customer_id: user.id.replace(/-/g, "").slice(0, 20),
            customer_email: profile?.email || user.email || "customer@example.com",
            customer_phone: "9999999999",
            customer_name: profile?.display_name || "Customer",
          },
          order_meta: {
            return_url: `${req.headers.get("origin") || Deno.env.get("SUPABASE_URL")}/checkout?order_id=${order.id}`,
          },
        }),
      });

      const cfData = await cfRes.json();

      if (!cfRes.ok || !cfData.payment_session_id) {
        return jsonRes({ error: cfData.message || "Cashfree order creation failed", details: cfData }, 500);
      }

      // Update order with Cashfree IDs
      await supabaseAdmin
        .from("orders")
        .update({
          cashfree_order_id: cfOrderId,
          payment_session_id: cfData.payment_session_id,
        })
        .eq("id", order.id);

      return jsonRes({
        payment_session_id: cfData.payment_session_id,
        cashfree_order_id: cfOrderId,
        order_id: order.id,
        mode: config.mode,
      });
    }

    // ── Verify payment ──
    if (action === "verify_payment") {
      const { order_id } = body;
      if (!order_id) return jsonRes({ error: "order_id required" }, 400);

      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .single();

      if (!order) return jsonRes({ error: "Order not found" }, 404);

      return jsonRes({ status: order.status, order });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonRes({ error: (err as Error).message }, 500);
  }
});
