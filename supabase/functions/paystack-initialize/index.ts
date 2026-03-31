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

    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: companyRequest, error: requestError } = await admin
      .from("company_requests")
      .select("id, email, company_name, admin_name, selected_plan, payment_status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !companyRequest) {
      return new Response(JSON.stringify({ error: "Company request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (companyRequest.payment_status === "paid") {
      return new Response(
        JSON.stringify({ error: "Payment already completed for this request" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const planId = companyRequest.selected_plan as PlanId;
    const plan = PLAN_CONFIG[planId];

    if (!plan) {
      return new Response(JSON.stringify({ error: "Invalid plan selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestOrigin = req.headers.get("origin") ?? "";
    const callbackUrl =
      Deno.env.get("PAYSTACK_CALLBACK_URL") ||
      (requestOrigin ? `${requestOrigin}/payment/callback` : undefined);

    if (!callbackUrl) {
      return new Response(JSON.stringify({ error: "Callback URL is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `sq_${requestId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${paystackSecret}`,
      },
      body: JSON.stringify({
        email: companyRequest.email,
        amount: plan.amountMinor,
        currency: plan.currency,
        reference,
        callback_url: callbackUrl,
        metadata: {
          request_id: companyRequest.id,
          plan_id: planId,
          company_name: companyRequest.company_name,
          admin_name: companyRequest.admin_name,
        },
      }),
    });

    const paystackJson = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackJson.status) {
      return new Response(
        JSON.stringify({ error: paystackJson.message || "Failed to initialize Paystack" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await admin
      .from("company_requests")
      .update({
        payment_status: "initialized",
        paystack_reference: reference,
        payment_amount: plan.amountMinor,
        payment_currency: plan.currency,
        payment_metadata: {
          init_response: paystackJson.data,
        },
      })
      .eq("id", companyRequest.id);

    await admin.from("payment_transactions").insert({
      request_id: companyRequest.id,
      paystack_reference: reference,
      plan_id: planId,
      amount: plan.amountMinor,
      currency: plan.currency,
      status: "initialized",
      raw_response: paystackJson,
    });

    return new Response(
      JSON.stringify({
        authorizationUrl: paystackJson.data?.authorization_url,
        reference,
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
