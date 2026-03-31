import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PaymentProvider = "paystack";

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

    if (!supabaseUrl || !serviceRole) {
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

    // ── Fetch Paystack key from platform_payment_settings (admin-configured) ──
    const { data: platformSettings } = await admin
      .from("platform_payment_settings")
      .select("paystack_secret_key, paystack_callback_url")
      .eq("id", 1)
      .maybeSingle();

    const paystackSecret =
      platformSettings?.paystack_secret_key ||
      Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!paystackSecret) {
      return new Response(
        JSON.stringify({
          error:
            "Paystack API key has not been configured. Please ask the Super Admin to enter the Paystack Secret Key in the admin panel under Paystack Settings.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: companyRequest, error: requestError } = await admin
      .from("company_requests")
      .select("id, email, company_name, admin_name, selected_plan, selected_currency, payment_status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !companyRequest) {
      return new Response(JSON.stringify({ error: "Company request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (companyRequest.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "Payment already completed for this request" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedProvider: PaymentProvider = "paystack";

    const { data: plan, error: planError } = await admin
      .from("billing_plans")
      .select("id, amount, currency")
      .eq("id", companyRequest.selected_plan)
      .maybeSingle();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Invalid plan selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedCurrency = (companyRequest.selected_currency || plan.currency || "USD").toUpperCase();

    const { data: currencyPrice } = await admin
      .from("billing_plan_prices")
      .select("amount, currency")
      .eq("plan_id", companyRequest.selected_plan)
      .eq("currency", requestedCurrency)
      .eq("is_active", true)
      .maybeSingle();

    const amountMinor = currencyPrice?.amount ?? plan.amount;
    const currency = (currencyPrice?.currency ?? plan.currency).toUpperCase();
    const requestOrigin = req.headers.get("origin") ?? "";

    // ── Callback URL: DB config > env var > request origin ──
    const callbackUrl =
      platformSettings?.paystack_callback_url ||
      Deno.env.get("PAYMENT_CALLBACK_URL") ||
      Deno.env.get("PAYSTACK_CALLBACK_URL") ||
      (requestOrigin ? `${requestOrigin}/payment/callback` : undefined);

    if (!callbackUrl) {
      return new Response(JSON.stringify({ error: "Callback URL is not configured. Please set it in Admin > Paystack Settings." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = `sq_${requestId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${paystackSecret}`,
      },
      body: JSON.stringify({
        email: companyRequest.email,
        amount: amountMinor,
        currency,
        reference,
        callback_url: callbackUrl,
        metadata: {
          request_id: companyRequest.id,
          plan_id: plan.id,
          provider: selectedProvider,
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.status) {
      return new Response(JSON.stringify({ error: payload.message || "Failed to initialize Paystack" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authorizationUrl = payload.data?.authorization_url;
    const initData = payload.data;

    if (!authorizationUrl) {
      return new Response(JSON.stringify({ error: "No authorization URL returned by gateway" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("company_requests")
      .update({
        payment_status: "initialized",
        payment_provider: selectedProvider,
        payment_reference: reference,
        paystack_reference: selectedProvider === "paystack" ? reference : null,
        payment_amount: amountMinor,
        payment_currency: currency,
        payment_metadata: {
          init_response: initData,
        },
      })
      .eq("id", companyRequest.id);

    await admin.from("payment_transactions").upsert(
      {
        request_id: companyRequest.id,
        provider: selectedProvider,
        paystack_reference: reference,
        payment_reference: reference,
        plan_id: plan.id,
        amount: amountMinor,
        gross_amount: amountMinor,
        commission_amount: 0,
        net_amount: amountMinor,
        currency,
        status: "initialized",
        raw_response: initData as Record<string, unknown>,
      },
      { onConflict: "paystack_reference" },
    );

    return new Response(
      JSON.stringify({
        authorizationUrl,
        reference,
        provider: selectedProvider,
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
