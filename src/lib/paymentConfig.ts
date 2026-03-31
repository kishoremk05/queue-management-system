import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_PLANS,
  type BillingPlan,
  type BillingPlanId,
  formatMoneyMinor,
} from "@/lib/billingPlans";

export type PaymentProvider = "paystack";

export function providerLabel(provider: PaymentProvider) {
  return provider === "paystack" ? "Paystack" : "Paystack";
}

export const DEFAULT_CURRENCY = "USD";

export async function loadAvailableCurrencies(): Promise<string[]> {
  const { data, error } = await supabase
    .from("billing_plan_prices")
    .select("currency")
    .eq("is_active", true);

  if (error || !data || data.length === 0) {
    return [DEFAULT_CURRENCY];
  }

  const unique = Array.from(new Set(data.map((row) => row.currency))).sort();
  return unique.length > 0 ? unique : [DEFAULT_CURRENCY];
}

export async function loadBillingPlans(currency = DEFAULT_CURRENCY): Promise<BillingPlan[]> {
  const [{ data: plans, error: planError }, { data: prices, error: priceError }] = await Promise.all([
    supabase
    .from("billing_plans")
      .select("id, name, description, amount, currency, period_label, features, cta, highlighted, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("billing_plan_prices")
      .select("plan_id, currency, amount")
      .eq("is_active", true)
      .eq("currency", currency),
  ]);

  if (planError || !plans || plans.length === 0) {
    return BILLING_PLANS;
  }

  const priceByPlanId = new Map<string, { currency: string; amount: number }>();
  if (!priceError && prices) {
    prices.forEach((row) => {
      priceByPlanId.set(row.plan_id, { currency: row.currency, amount: row.amount });
    });
  }

  const mapped: BillingPlan[] = plans
    .map((row) => {
      const features = Array.isArray(row.features)
        ? row.features.filter((item): item is string => typeof item === "string")
        : [];
      const override = priceByPlanId.get(row.id);
      const resolvedCurrency = override?.currency || row.currency || DEFAULT_CURRENCY;
      const resolvedAmount = override?.amount ?? row.amount;
      return {
        id: row.id as BillingPlanId,
        name: row.name,
        description: row.description,
        amountMinor: resolvedAmount,
        currency: resolvedCurrency,
        periodLabel: row.period_label || "/month",
        priceLabel: formatMoneyMinor(resolvedAmount, resolvedCurrency),
        features,
        cta: row.cta || "Choose Plan",
        highlighted: !!row.highlighted,
      };
    })
    .filter((row) => row.id === "starter" || row.id === "professional" || row.id === "enterprise");

  return mapped.length > 0 ? mapped : BILLING_PLANS;
}

export async function loadDefaultPaymentProvider(): Promise<PaymentProvider> {
  return "paystack";
}
