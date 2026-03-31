import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PaymentProvider = "paystack";

type CommissionType = "percentage" | "flat";

const DEFAULT_SETTINGS = {
  commission_type: "percentage" as CommissionType,
  commission_value: 2.5,
  commission_flat_amount: 0,
};

function computeCommission(
  grossAmount: number,
  commissionType: CommissionType,
  commissionValue: number,
  commissionFlatAmount: number,
) {
  if (grossAmount <= 0) {
    return 0;
  }

  if (commissionType === "flat") {
    return Math.min(grossAmount, Math.max(0, Math.round(commissionFlatAmount)));
  }

  const rate = Math.max(0, commissionValue);
  const value = Math.round((grossAmount * rate) / 100);
  return Math.min(grossAmount, value);
}

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

    const [{ data: transaction }, { data: settings }] = await Promise.all([
      admin
        .from("payment_transactions")
        .select("request_id, provider, plan_id, amount, currency")
        .or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("platform_payment_settings")
        .select("commission_type, commission_value, commission_flat_amount, paystack_secret_key")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    // ── Fetch Paystack key from DB (admin-configured) with env var fallback ──
    const paystackSecret =
      settings?.paystack_secret_key ||
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

    const resolvedProvider: PaymentProvider = "paystack";

    let grossAmount = transaction?.amount ?? 0;
    let currency = transaction?.currency ?? "USD";
    let paidAt: string | null = null;
    let isSuccess = false;
    let gatewayMessage: string | null = null;
    let requestId = transaction?.request_id ?? null;
    let planId = transaction?.plan_id ?? "professional";
    let rawResponse: unknown = null;

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } },
    );
    const payload = await response.json();

    if (!response.ok || !payload.status) {
      return new Response(JSON.stringify({ error: payload.message || "Failed to verify Paystack payment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data;
    rawResponse = data;
    const metadata = data?.metadata ?? {};
    requestId = requestId ?? metadata.request_id ?? null;
    planId = (metadata.plan_id as string | undefined) ?? planId;
    grossAmount = data?.amount ?? grossAmount;
    currency = data?.currency ?? currency;
    paidAt = data?.paid_at ? new Date(data.paid_at).toISOString() : null;
    gatewayMessage = data?.gateway_response ?? null;
    isSuccess = data?.status === "success";

    if (!requestId) {
      return new Response(JSON.stringify({ error: "Unable to map payment reference to a company request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const commissionType = (settings?.commission_type as CommissionType | undefined) ?? DEFAULT_SETTINGS.commission_type;
    const commissionValue = Number(settings?.commission_value ?? DEFAULT_SETTINGS.commission_value);
    const commissionFlatAmount = Number(settings?.commission_flat_amount ?? DEFAULT_SETTINGS.commission_flat_amount);

    const commissionAmount = isSuccess
      ? computeCommission(grossAmount, commissionType, commissionValue, commissionFlatAmount)
      : 0;
    const netAmount = Math.max(0, grossAmount - commissionAmount);
    const normalizedStatus = isSuccess ? "paid" : "failed";

    await admin
      .from("company_requests")
      .update({
        payment_status: normalizedStatus,
        status: isSuccess ? "pending" : "pending_payment",
        payment_provider: resolvedProvider,
        payment_reference: reference,
        paystack_reference: resolvedProvider === "paystack" ? reference : null,
        payment_amount: grossAmount,
        payment_currency: currency,
        paid_at: paidAt,
        payment_metadata: {
          verify_response: rawResponse,
          commission: {
            commission_type: commissionType,
            commission_value: commissionValue,
            commission_amount: commissionAmount,
            net_amount: netAmount,
          },
        },
      })
      .eq("id", requestId);

    await admin
      .from("payment_transactions")
      .upsert(
        {
          request_id: requestId,
          provider: resolvedProvider,
          plan_id: planId,
          paystack_reference: reference,
          payment_reference: reference,
          amount: grossAmount,
          gross_amount: grossAmount,
          commission_amount: commissionAmount,
          net_amount: netAmount,
          currency,
          status: normalizedStatus,
          gateway_message: gatewayMessage,
          paid_at: paidAt,
          raw_response: rawResponse as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "paystack_reference" },
      );

    return new Response(
      JSON.stringify({
        success: isSuccess,
        paymentStatus: normalizedStatus,
        provider: resolvedProvider,
        grossAmount,
        commissionAmount,
        netAmount,
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
