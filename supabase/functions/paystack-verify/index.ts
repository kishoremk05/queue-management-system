import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PlanId = "starter" | "professional" | "enterprise";

const PLAN_CONFIG: Record<PlanId, { amountMinor: number; currency: "NGN" }> = {
  starter: { amountMinor: 2900000, currency: "NGN" },
  professional: { amountMinor: 7900000, currency: "NGN" },
  enterprise: { amountMinor: 19900000, currency: "NGN" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!supabaseUrl || !serviceRole || !paystackSecret) {
      return new Response(JSON.stringify({ error: "Server config missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "reference is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
        },
      },
    );

    const paystackJson = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackJson.status) {
      await admin
        .from("payment_transactions")
        .upsert(
          {
            paystack_reference: reference,
            plan_id: "professional",
            amount: 0,
            currency: "NGN",
            status: "verify_failed",
            gateway_message: paystackJson.message ?? "Verification failed",
            raw_response: paystackJson,
          },
          { onConflict: "paystack_reference" },
        );

      return new Response(
        JSON.stringify({ error: paystackJson.message || "Failed to verify payment" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = paystackJson.data;
    const metadata = data?.metadata ?? {};
    const requestId = metadata.request_id as string | undefined;
    const planId = metadata.plan_id as PlanId | undefined;
    const transactionStatus = data?.status as string;

    if (!requestId || !planId || !PLAN_CONFIG[planId]) {
      return new Response(
        JSON.stringify({ error: "Invalid payment metadata from Paystack" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizedStatus = transactionStatus === "success" ? "paid" : "failed";

    const paidAt = data?.paid_at ? new Date(data.paid_at).toISOString() : null;

    await admin
      .from("company_requests")
      .update({
        payment_status: normalizedStatus,
        status: normalizedStatus === "paid" ? "pending" : "pending_payment",
        paystack_reference: reference,
        payment_amount: data?.amount ?? PLAN_CONFIG[planId].amountMinor,
        payment_currency: data?.currency ?? PLAN_CONFIG[planId].currency,
        paid_at: paidAt,
        payment_metadata: {
          verify_response: data,
        },
      })
      .eq("id", requestId);

    await admin
      .from("payment_transactions")
      .upsert(
        {
          request_id: requestId,
          paystack_reference: reference,
          plan_id: planId,
          amount: data?.amount ?? PLAN_CONFIG[planId].amountMinor,
          currency: data?.currency ?? PLAN_CONFIG[planId].currency,
          status: normalizedStatus,
          gateway_message: data?.gateway_response ?? null,
          paid_at: paidAt,
          raw_response: data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "paystack_reference" },
      );

    return new Response(
      JSON.stringify({
        success: normalizedStatus === "paid",
        paymentStatus: normalizedStatus,
        planId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
